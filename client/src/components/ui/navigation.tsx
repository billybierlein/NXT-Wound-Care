import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Plus, List, LogOut, Home, Users, Activity, UserCheck, Calculator as CalculatorIcon, BarChart3, Building2, User, Lock, ChevronDown, Wrench, Bot } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
    { href: "/manage-providers", label: "Providers", icon: UserCheck },
    { href: "/manage-referral-sources", label: "Referral Sources", icon: Building2 },
    ...((user as any)?.role === 'sales_rep' ? [
      { href: "/sales-reports", label: "Sales Reports", icon: BarChart3 }
    ] : []),
    ...((user as any)?.role === 'admin' ? [
      { href: "/sales-reports", label: "Sales Reports", icon: BarChart3 },
      { href: "/manage-sales-reps", label: "Sales Reps", icon: Users }
    ] : []),
  ];

  const toolsItems = [
    { href: "/calculator", label: "Provider Revenue Calculator", icon: CalculatorIcon },
    { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
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
            
            {/* Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    toolsItems.some(item => location === item.href)
                      ? "text-primary bg-blue-50" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Tools
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {toolsItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem>
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </DropdownMenuItem>
                    </Link>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <User className="h-4 w-4" />
                  <span className="ml-2 hidden md:block">{(user as any)?.firstName || (user as any)?.salesRepName || (user as any)?.email}</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href="/change-password">
                  <DropdownMenuItem>
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200 w-full">
          <div className="flex items-center px-1 py-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-shrink-0">
                  <div className={`flex flex-col items-center px-3 py-2 text-xs min-w-[70px] ${
                    isActive 
                      ? "text-primary" 
                      : "text-gray-600"
                  }`}>
                    <Icon className="h-4 w-4 mb-1" />
                    <span className="text-center text-[10px] leading-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
            
            {/* Mobile Tools Items */}
            {toolsItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-shrink-0">
                  <div className={`flex flex-col items-center px-3 py-2 text-xs min-w-[70px] ${
                    isActive 
                      ? "text-primary" 
                      : "text-gray-600"
                  }`}>
                    <Icon className="h-4 w-4 mb-1" />
                    <span className="text-center text-[10px] leading-tight">Calculator</span>
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
