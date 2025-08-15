import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Mail, Trash2, Copy, Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import Navigation from "@/components/ui/navigation";

interface Invitation {
  id: number;
  email: string;
  token: string;
  role: string;
  commissionRate: string;
  isUsed: boolean;
  expiresAt: string;
  createdAt: string;
}

export default function ManageInvitations() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [commissionRate, setCommissionRate] = useState("10.00");

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/auth/invitations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/invitations");
      return response.json();
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; commissionRate: string }) => {
      const response = await apiRequest("POST", "/api/auth/invitations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invitations"] });
      setEmail("");
      setRole("sales_rep");
      setCommissionRate("10.00");
      toast({
        title: "Invitation sent",
        description: "Registration invitation sent successfully via email",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/auth/invitations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invitations"] });
      toast({
        title: "Invitation deleted",
        description: "Registration invitation removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    createInvitationMutation.mutate({ email, role, commissionRate });
  };

  const copyInvitationLink = (token: string) => {
    const baseUrl = window.location.origin;
    const invitationUrl = `${baseUrl}/register/${token}`;
    navigator.clipboard.writeText(invitationUrl);
    toast({
      title: "Link copied",
      description: "Invitation link copied to clipboard",
    });
  };

  const getStatusBadge = (invitation: Invitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    
    if (invitation.isUsed) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Used</Badge>;
    } else if (expiresAt < now) {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading invitations...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Manage Invitations</h1>
          <p className="text-muted-foreground mt-2">
            Create secure registration invitations for new sales representatives
          </p>
        </div>

      {/* Create Invitation Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New Invitation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_rep">Sales Representative</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                <Input
                  id="commissionRate"
                  type="number"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="10.00"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button 
                  type="submit" 
                  disabled={createInvitationMutation.isPending}
                  className="w-full"
                >
                  {createInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Active Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invitations created yet. Create your first invitation above.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Commission Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        {invitation.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invitation.role === 'admin' ? 'Administrator' : 'Sales Rep'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {invitation.commissionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invitation)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(invitation.createdAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(invitation.expiresAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!invitation.isUsed && new Date(invitation.expiresAt) > new Date() && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInvitationLink(invitation.token)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Link
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                            disabled={deleteInvitationMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}