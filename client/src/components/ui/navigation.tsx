import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Heart, Plus, List, LogOut, Home, Users, Activity } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/add-patient", label: "Add Patient", icon: Plus },
    { href: "/manage-patients", label: "Manage Patients", icon: List },
    { href: "/patient-treatments", label: "Patient Treatments", icon: Activity },
    { href: "/manage-sales-reps", label: "Sales Reps", icon: Users },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Heart className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                WoundCare Patient Manager
              </h1>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? "text-primary bg-blue-50" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}>
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden md:block">
              {user?.firstName || user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden md:block">Logout</span>
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex flex-col items-center px-3 py-2 text-xs ${
                    isActive 
                      ? "text-primary" 
                      : "text-gray-600"
                  }`}>
                    <Icon className="h-5 w-5 mb-1" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
