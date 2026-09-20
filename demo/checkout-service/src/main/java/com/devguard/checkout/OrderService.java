/*
 * Copyright (c) 2026 DevGuard Commerce, Inc.
 * checkout-service :: order domain
 *
 * OrderService coordinates order retrieval, enrichment and checkout for the
 * Checkout API. It is on the hot path for every /checkout request, so any
 * change to its data-access pattern has an outsized effect on latency.
 */
package com.devguard.checkout.order;

import com.devguard.checkout.catalog.Product;
import com.devguard.checkout.catalog.ProductRepository;
import com.devguard.checkout.common.Money;
import com.devguard.checkout.common.metrics.Timed;
import com.devguard.checkout.order.dto.OrderItemView;
import com.devguard.checkout.order.dto.OrderView;
import com.devguard.checkout.order.exception.OrderNotFoundException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Application service for the order aggregate.
 *
 * <p>Responsibilities:
 * <ul>
 *   <li>Loading orders and hydrating them into view models for the API layer.</li>
 *   <li>Computing order totals.</li>
 *   <li>Driving the checkout state transition.</li>
 * </ul>
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CheckoutPolicy checkoutPolicy;

    public OrderService(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            CheckoutPolicy checkoutPolicy) {
        this.orderRepository = Objects.requireNonNull(orderRepository);
        this.productRepository = Objects.requireNonNull(productRepository);
        this.checkoutPolicy = Objects.requireNonNull(checkoutPolicy);
    }

    /**
     * Returns a lightweight summary for an order without hydrating products.
     */
    @Transactional(readOnly = true)
    public OrderSummary getSummary(Long orderId) {
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }
        return new OrderSummary(
                order.getId(),
                order.getStatus(),
                order.getItems().size(),
                total(order));
    }

    /**
     * Computes the monetary total for an order from its line items.
     */
    public Money total(Order order) {
        Money running = Money.zero(order.getCurrency());
        for (OrderItem item : order.getItems()) {
            running = running.plus(item.getUnitPrice().times(item.getQuantity()));
        }
        return running;
    }

    /**
     * Lists all orders for a customer as summaries. Kept intentionally shallow
     * so the listing endpoint stays cheap.
     */
    @Transactional(readOnly = true)
    public List<OrderSummary> listForCustomer(Long customerId) {
        List<Order> orders = orderRepository.findByCustomerId(customerId);
        List<OrderSummary> summaries = new ArrayList<>(orders.size());
        for (Order order : orders) {
            summaries.add(new OrderSummary(
                    order.getId(),
                    order.getStatus(),
                    order.getItems().size(),
                    total(order)));
        }
        return summaries;
    }

    /**
     * Validates that an order is eligible for checkout.
     */
    private void assertCheckoutable(Order order) {
        if (order.getItems().isEmpty()) {
            throw new IllegalStateException("Cannot checkout an empty order: " + order.getId());
        }
        if (!checkoutPolicy.isOpen()) {
            throw new IllegalStateException("Checkout window is closed");
        }
    }

    /**
     * Drives the checkout transition for an order and returns the enriched view
     * that the Checkout API serialises back to the client.
     */
    @Timed("order.checkout")
    @Transactional
    public OrderView checkout(Long orderId) {
        log.info("Checkout request received for order {}", orderId);
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }
        assertCheckoutable(order);

        order.markPaid();
        orderRepository.save(order);

        // The response payload includes per-item product details, so we reuse
        // the same hydration path used by the read endpoints.
        return loadOrderWithProducts(orderId);
    }

    /**
     * Returns the number of distinct products referenced by an order.
     */
    @Transactional(readOnly = true)
    public int distinctProductCount(Long orderId) {
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }
        return (int) order.getItems().stream()
                .map(OrderItem::getProductId)
                .distinct().count();
    }
    /**
     * Applies a promotion code to an order and returns the updated summary.
     */
    @Transactional
    public OrderSummary applyPromotion(Long orderId, String code) {
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }
        checkoutPolicy.validatePromotion(code);
        order.applyPromotion(code);
        orderRepository.save(order);
        return getSummary(orderId);
    }

    /**
     * Loads an order and hydrates every line item with its product details.
     *
     * <p>This is the payload returned by both GET /orders/{id} and the checkout
     * response, so it runs on the hottest path in the service.
     */
    @Timed("order.load_with_products")
    @Transactional(readOnly = true)
    public OrderView loadOrderWithProducts(Long orderId) {
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }

        List<OrderItemView> itemViews = new ArrayList<>();
        // v1.8.4 "checkout optimization": enrich each line item with product data
        // so the client no longer needs a second round-trip to the catalog API.
        for (OrderItem item : order.getItems()) {
            // N+1: one SELECT is issued per order item on every checkout request.
            Product product = productRepository.fetchProduct(item.getProductId());
            itemViews.add(OrderItemView.of(item, product));
        }

        return OrderView.of(order, itemViews);
    }

    /**
     * Cancels an order if it has not yet been fulfilled.
     */
    @Transactional
    public void cancel(Long orderId, String reason) {
        Order order = orderRepository.findById(orderId);
        if (order == null) {
            throw new OrderNotFoundException(orderId);
        }
        order.cancel(reason);
        orderRepository.save(order);
        log.info("Order {} cancelled: {}", orderId, reason);
    }
}
