import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalesRepSchema, type InsertSalesRep, type SalesRep } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, Plus, Edit, Trash2, Save, X } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { isUnauthorizedError } from "@/lib/authUtils";

const formSchema = insertSalesRepSchema.extend({
  name: insertSalesRepSchema.shape.name.min(1, "Name is required"),
});

export default function ManageSalesReps() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const form = useForm<InsertSalesRep>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      isActive: true,
    },
  });

  const editForm = useForm<InsertSalesRep>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      isActive: true,
    },
  });

  // Fetch sales reps
  const { data: salesReps = [], isLoading: salesRepsLoading } = useQuery({
    queryKey: ["/api/sales-reps"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Create sales rep mutation
  const createSalesRepMutation = useMutation({
    mutationFn: async (salesRep: InsertSalesRep) => {
      const response = await apiRequest("POST", "/api/sales-reps", salesRep);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({
        title: "Success",
        description: "Sales representative added successfully!",
      });
      form.reset();
      setShowAddForm(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to add sales representative",
        variant: "destructive",
      });
    },
  });

  // Update sales rep mutation
  const updateSalesRepMutation = useMutation({
    mutationFn: async ({ id, salesRep }: { id: number; salesRep: InsertSalesRep }) => {
      const response = await apiRequest("PUT", `/api/sales-reps/${id}`, salesRep);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({
        title: "Success",
        description: "Sales representative updated successfully!",
      });
      setEditingId(null);
      editForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to update sales representative",
        variant: "destructive",
      });
    },
  });

  // Delete sales rep mutation
  const deleteSalesRepMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/sales-reps/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-reps"] });
      toast({
        title: "Success",
        description: "Sales representative deactivated successfully!",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate sales representative",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertSalesRep) => {
    createSalesRepMutation.mutate(data);
  };

  const handleEditSubmit = (data: InsertSalesRep) => {
    if (editingId) {
      updateSalesRepMutation.mutate({ id: editingId, salesRep: data });
    }
  };

  const handleEdit = (salesRep: SalesRep) => {
    setEditingId(salesRep.id);
    editForm.reset({
      name: salesRep.name,
      email: salesRep.email || "",
      isActive: salesRep.isActive,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    editForm.reset();
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to deactivate this sales representative?")) {
      deleteSalesRepMutation.mutate(id);
    }
  };

  if (isLoading || salesRepsLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manage Sales Representatives</h1>
              <p className="text-gray-600 mt-1">Add, edit, and manage your sales team</p>
            </div>
            <Button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Sales Rep
            </Button>
          </div>
        </div>

        {/* Add Sales Rep Form */}
        {showAddForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Add New Sales Representative
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john.smith@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Enable this sales representative to receive new leads
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createSalesRepMutation.isPending}
                    >
                      {createSalesRepMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Add Sales Rep
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Sales Reps Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sales Representatives ({salesReps.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesReps.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No sales representatives found</p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Sales Rep
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesReps.map((salesRep: SalesRep) => (
                    <TableRow key={salesRep.id}>
                      <TableCell>
                        {editingId === salesRep.id ? (
                          <Form {...editForm}>
                            <FormField
                              control={editForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </Form>
                        ) : (
                          <span className="font-medium">{salesRep.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === salesRep.id ? (
                          <Form {...editForm}>
                            <FormField
                              control={editForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </Form>
                        ) : (
                          <span className="text-gray-600">{salesRep.email || "No email"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === salesRep.id ? (
                          <Form {...editForm}>
                            <FormField
                              control={editForm.control}
                              name="isActive"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </Form>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            salesRep.isActive 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {salesRep.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(salesRep.createdAt || '').toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {editingId === salesRep.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700"
                                onClick={editForm.handleSubmit(handleEditSubmit)}
                                disabled={updateSalesRepMutation.isPending}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-600 hover:text-gray-700"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-blue-700"
                                onClick={() => handleEdit(salesRep)}
                                title="Edit sales rep"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(salesRep.id)}
                                disabled={deleteSalesRepMutation.isPending}
                                title="Deactivate sales rep"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}