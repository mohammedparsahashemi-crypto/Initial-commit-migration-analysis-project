import numpy as np
from sklearn.linear_model import LinearRegression
import random

class Predictor:
    def predict(self, historical_data, years=5):
        if not historical_data or 'net' not in historical_data:
            return []
        
        net_values = historical_data['net']
        
        if len(net_values) < 3:
            avg = np.mean(net_values) if net_values else 0
            std = np.std(net_values) if len(net_values) > 1 else 1000
            return [
                {
                    "predicted_net": float(avg + random.uniform(-std*0.5, std*0.5)),
                    "upper_bound": float(avg + std),
                    "lower_bound": float(avg - std)
                }
                for _ in range(years)
            ]
        
        X = np.array(range(len(net_values))).reshape(-1, 1)
        y = np.array(net_values)
        
        model = LinearRegression()
        model.fit(X, y)
        
        predictions = []
        for i in range(1, years + 1):
            pred_val = model.predict(np.array([[len(net_values) + i - 1]]))[0]
            
            residuals = y - model.predict(X)
            std_error = np.std(residuals) if len(residuals) > 0 else 3000
            
            if std_error < 1000:
                std_error = 3000
            
            predictions.append({
                "predicted_net": float(pred_val),
                "upper_bound": float(pred_val + 1.96 * std_error),
                "lower_bound": float(pred_val - 1.96 * std_error)
            })
        
        return predictions