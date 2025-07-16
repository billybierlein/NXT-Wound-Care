import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Heart className="h-16 w-16 text-primary" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              WoundCare Lead Manager
            </h1>
            
            <p className="text-gray-600 mb-6">
              Secure patient lead management for wound care professionals
            </p>
            
            <Button 
              onClick={handleLogin}
              className="w-full"
              size="lg"
            >
              Sign In to Continue
            </Button>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Manage patient referrals • Track sales activity • Export data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
