// Content script for PointPilot Safari extension

class PointPilot {
    constructor() {
        this.initialized = false;
        this.pointRates = {};
        this.priceElements = new Set();
        this.observer = null;
    }

    init() {
        if (this.initialized) return;
        
        // Request point rates from the extension
        safari.extension.dispatchMessage("getPointRates");
        
        // Set up mutation observer to detect new price elements
        this.setupObserver();
        
        // Initial scan for prices
        this.scanForPrices();
        
        this.initialized = true;
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    this.scanForPrices();
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForPrices() {
        // Common price element selectors
        const selectors = [
            '[data-price]',
            '.price',
            '.amount',
            '[class*="price"]',
            '[class*="amount"]'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!this.priceElements.has(element)) {
                    this.processPriceElement(element);
                    this.priceElements.add(element);
                }
            });
        });
    }

    processPriceElement(element) {
        const price = this.extractPrice(element);
        if (price) {
            const message = {
                type: "detectFlightPrices",
                prices: [{
                    amount: price,
                    currency: "USD"
                }]
            };
            safari.extension.dispatchMessage(message);
        }
    }

    extractPrice(element) {
        const text = element.textContent.trim();
        const match = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
        return null;
    }

    updatePointPrices(prices) {
        prices.forEach(price => {
            const cashAmount = price.cash;
            const pointAmounts = Object.entries(price)
                .filter(([key]) => key !== 'cash')
                .map(([program, points]) => `${program}: ${points} pts`);

            // Find the original price element
            const priceElements = Array.from(this.priceElements);
            const originalElement = priceElements.find(el => 
                this.extractPrice(el) === cashAmount
            );

            if (originalElement) {
                this.createPointOverlay(originalElement, pointAmounts);
            }
        });
    }

    createPointOverlay(originalElement, pointAmounts) {
        const overlay = document.createElement('div');
        overlay.className = 'pointpilot-overlay';
        overlay.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            padding: 8px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 10000;
            font-size: 12px;
            line-height: 1.4;
        `;

        pointAmounts.forEach(amount => {
            const line = document.createElement('div');
            line.textContent = amount;
            overlay.appendChild(line);
        });

        const rect = originalElement.getBoundingClientRect();
        overlay.style.top = `${rect.bottom + window.scrollY + 5}px`;
        overlay.style.left = `${rect.left + window.scrollX}px`;

        document.body.appendChild(overlay);
    }
}

// Initialize PointPilot
const pointPilot = new PointPilot();
pointPilot.init();

// Listen for messages from the extension
safari.self.addEventListener("message", (event) => {
    if (event.name === "updatePointPrices") {
        pointPilot.updatePointPrices(event.message.prices);
    } else if (event.name === "updatePointRates") {
        pointPilot.pointRates = event.message.rates;
    }
}); 