import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Users, FileSpreadsheet, TrendingUp } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: leads } = useQuery({
    queryKey: ["/api/leads"],
    retry: false,
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const totalLeads = leads?.length || 0;
  const recentLeads = leads?.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || user?.email}
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your patient leads and track referral activity
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                Patient leads in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads?.filter(lead => {
                  const leadDate = new Date(lead.createdAt || '');
                  const now = new Date();
                  return leadDate.getMonth() === now.getMonth() && 
                         leadDate.getFullYear() === now.getFullYear();
                }).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                New leads added
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/add-lead">
                  <Button size="sm" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No leads yet</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first patient lead</p>
                <Link href="/add-lead">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Lead
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentLeads.map((lead) => (
                  <div key={lead.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900 text-lg">
                        {lead.firstName} {lead.lastName}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {(() => {
                          // Convert YYYY-MM-DD to MM/DD/YYYY for display
                          const dateStr = lead.createdAt || '';
                          const date = new Date(dateStr);
                          return date.toLocaleDateString('en-US');
                        })()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Referral Source:</span>
                        <span className="ml-2 text-gray-900">{lead.referralSource}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Sales Rep:</span>
                        <span className="ml-2 text-gray-900">{lead.salesRep}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Insurance:</span>
                        <span className="ml-2 text-gray-900">
                          {lead.insurance === "other" && lead.customInsurance ? lead.customInsurance : lead.insurance}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Date Added:</span>
                        <span className="ml-2 text-gray-900">
                          {(() => {
                            const dateStr = lead.createdAt || '';
                            const date = new Date(dateStr);
                            return date.toLocaleDateString('en-US');
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Wound Type:</span>
                        <span className="ml-2 text-gray-900">{lead.woundType || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Wound Size:</span>
                        <span className="ml-2 text-gray-900">
                          {lead.woundSize ? `${lead.woundSize} sq cm` : 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {totalLeads > 5 && (
                  <div className="text-center pt-4">
                    <Link href="/manage-leads">
                      <Button variant="outline">View All Leads</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
