//
//  SafariWebExtensionHandler.swift
//  PointPilot Extension
//
//  Created by Daniel Narewski on 5/3/25.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    // Point conversion rates (will be made configurable)
    private let pointRates: [String: Double] = [
        "amex": 1.8,  // cents per point
        "chase": 1.5,
        "capitalone": 1.4,
        "citi": 1.6
    ]
    
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as! NSExtensionItem
        let message = item.userInfo?[SFExtensionMessageKey]
        
        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@", message as! CVarArg)
        
        let response = NSExtensionItem()
        
        if let message = message as? [String: Any] {
            if let type = message["type"] as? String {
                switch type {
                case "detectFlightPrices":
                    if let prices = message["prices"] as? [[String: Any]] {
                        let pointPrices = processFlightPrices(prices)
                        response.userInfo = [SFExtensionMessageKey: ["prices": pointPrices]]
                    }
                case "getPointRates":
                    response.userInfo = [SFExtensionMessageKey: ["rates": pointRates]]
                default:
                    break
                }
            }
        }
        
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    
    private func processFlightPrices(_ prices: [[String: Any]]) -> [[String: Any]] {
        var pointPrices: [[String: Any]] = []
        
        for price in prices {
            guard let amount = price["amount"] as? Double,
                  let currency = price["currency"] as? String else { continue }
            
            if currency == "USD" {
                var pointPrice: [String: Any] = ["cash": amount]
                
                // Calculate point prices for each program
                for (program, rate) in pointRates {
                    let points = Int(amount * 100 / rate)
                    pointPrice[program] = points
                }
                
                pointPrices.append(pointPrice)
            }
        }
        
        return pointPrices
    }
}
