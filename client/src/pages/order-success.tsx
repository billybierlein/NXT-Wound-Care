import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function OrderSuccess() {
  const [, setLocation] = useLocation();

  const handleNewOrder = () => {
    setLocation("/provider-order-form");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Order Submitted, Thank You!
          </h1>
          <p className="text-gray-600 mb-6">
            You should receive an email with a copy of your order receipt.
          </p>
          <p className="text-gray-600 mb-8">
            Please close this window, or place a new order by clicking the button below.
          </p>
        </div>
        
        <Button 
          onClick={handleNewOrder}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          Place New Order
        </Button>
      </div>
    </div>
  );
}