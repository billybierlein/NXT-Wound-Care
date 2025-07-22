import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Plus, List, LogOut, Home, Users, Activity, UserCheck, Calculator as CalculatorIcon, BarChart3 } from "lucide-react";
import nxtLogo from "@assets/nxtess_1753137167398.png";
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
    { href: "/sales-reports", label: "Sales Reports", icon: BarChart3 },
    { href: "/calculator", label: "Calculator", icon: CalculatorIcon },
    ...((user as any)?.role === 'admin' ? [
      { href: "/manage-sales-reps", label: "Sales Reps", icon: Users },
      { href: "/manage-providers", label: "Providers", icon: UserCheck }
    ] : []),
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 w-full">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src={nxtLogo} alt="NXT Medical" className="h-8 w-8 object-contain" style={{ display: 'block' }} />
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
              {(user as any)?.firstName || (user as any)?.email}
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
        <div className="md:hidden border-t border-gray-200 w-full overflow-hidden">
          <div className="flex items-center justify-between px-1 py-2 min-w-0">
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-1 min-w-0">
                  <div className={`flex flex-col items-center px-1 py-2 text-xs ${
                    isActive 
                      ? "text-primary" 
                      : "text-gray-600"
                  }`}>
                    <Icon className="h-4 w-4 mb-1" />
                    <span className="truncate text-center text-[10px] leading-tight max-w-full">{item.label}</span>
                  </div>
                </Link>
              );
            })}
            {/* More menu for additional items */}
            {navItems.length > 4 && (
              <div className="flex-1 min-w-0">
                <div className="flex flex-col items-center px-1 py-2 text-xs text-gray-600">
                  <Plus className="h-4 w-4 mb-1" />
                  <span className="truncate text-center text-[10px] leading-tight">More</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
