import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Download, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface OrderItem {
  id: string;
  productCode: string;
  manufacturer: string;
  costPerUnit: string;
  quantity: string;
  orderType: string;
}

export default function ProviderOrderForm() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Shipping Information
  const [facilityName, setFacilityName] = useState("");
  const [shippingContactName, setShippingContactName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [faxNumber, setFaxNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [dateOfCase, setDateOfCase] = useState("");
  const [productArrivalDateTime, setProductArrivalDateTime] = useState("");

  // Billing Information
  const [billingDifferent, setBillingDifferent] = useState(false);
  const [billingFacilityName, setBillingFacilityName] = useState("");
  const [billingContactName, setBillingContactName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingPhoneNumber, setBillingPhoneNumber] = useState("");
  const [billingFaxNumber, setBillingFaxNumber] = useState("");
  const [billingEmailAddress, setBillingEmailAddress] = useState("");

  // Order Details
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      id: "1",
      productCode: "",
      manufacturer: "",
      costPerUnit: "",
      quantity: "",
      orderType: "Direct Order"
    }
  ]);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");

  const addOrderItem = () => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      productCode: "",
      manufacturer: "",
      costPerUnit: "",
      quantity: "",
      orderType: "Direct Order"
    };
    setOrderItems([...orderItems, newItem]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: string) => {
    setOrderItems(orderItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotalCost = (costPerUnit: string, quantity: string): string => {
    const cost = parseFloat(costPerUnit) || 0;
    const qty = parseInt(quantity) || 0;
    return (cost * qty).toFixed(2);
  };

  const calculateGrandTotal = (): string => {
    return orderItems.reduce((total, item) => {
      const itemTotal = parseFloat(calculateTotalCost(item.costPerUnit, item.quantity)) || 0;
      return total + itemTotal;
    }, 0).toFixed(2);
  };

  const formatCurrency = (amount: string): string => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Order Form", 105, 20, { align: "center" });
      
      // Shipping Information
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Shipping Information", 20, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let yPos = 50;
      
      const shippingInfo = [
        ["Facility Name", facilityName],
        ["Shipping Contact Name", shippingContactName],
        ["Shipping Address", shippingAddress],
        ["Phone Number", phoneNumber],
        ["Fax Number", faxNumber],
        ["Email Address", emailAddress],
        ["Date of Case", dateOfCase],
        ["Product Arrival Date & Time", productArrivalDateTime]
      ];
      
      shippingInfo.forEach(([label, value]) => {
        doc.text(`${label}: ${value}`, 20, yPos);
        yPos += 7;
      });
      
      // Billing Information
      yPos += 10;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Billing Information (if different from Shipping Information)", 20, yPos);
      yPos += 10;
      
      if (billingDifferent) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const billingInfo = [
          ["Facility Name", billingFacilityName],
          ["Billing Contact Name", billingContactName],
          ["Shipping Address", billingAddress],
          ["Phone Number", billingPhoneNumber],
          ["Fax Number", billingFaxNumber],
          ["Email Address", billingEmailAddress]
        ];
        
        billingInfo.forEach(([label, value]) => {
          doc.text(`${label}: ${value}`, 20, yPos);
          yPos += 7;
        });
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Same as shipping information", 20, yPos);
        yPos += 7;
      }
      
      // Order Details Table
      yPos += 15;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Order Details", 20, yPos);
      yPos += 10;
      
      const tableData = orderItems.map(item => [
        item.productCode,
        item.manufacturer,
        formatCurrency(item.costPerUnit),
        item.quantity,
        formatCurrency(calculateTotalCost(item.costPerUnit, item.quantity)),
        item.orderType
      ]);
      
      (doc as any).autoTable({
        startY: yPos,
        head: [["Product Code", "Manufacturer", "Cost Per Unit", "Quantity", "Total Cost", "Order Type"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] }
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // Purchase Order Number
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Purchase Order Number: ${purchaseOrderNumber}`, 20, yPos);
      yPos += 15;
      
      // Grand Total
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Grand Total: ${formatCurrency(calculateGrandTotal())}`, 20, yPos);
      yPos += 20;
      
      // Footer Information
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Email completed form to Orders@RxWound.com", 105, yPos, { align: "center" });
      yPos += 15;
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const footerText = [
        "Order Cut Off Time – 4pm EST (Any order submitted after 4pm EST may be processed",
        "the next business day)",
        "",
        "Accounts with past due balance will require approval from accounting department before orders are processed",
        "",
        "Delivery delays are always possible. To ensure product arrives promptly for cases, please consider placing all",
        "orders at least 2-3 days before date of surgery.",
        "",
        "Account is responsible for cost of any lost product after delivery is successfully made"
      ];
      
      footerText.forEach(line => {
        doc.text(line, 20, yPos);
        yPos += 5;
      });
      
      // Version
      doc.text("REV3.1", 180, 280);
      
      // Save the PDF
      const fileName = `Order_Form_${facilityName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "PDF Generated",
        description: `Order form has been downloaded as ${fileName}`,
      });
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

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
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Provider Order Form</h1>
          <p className="text-gray-600 mt-2">Create orders for tissue bank grafts</p>
        </div>

        <div className="space-y-6">
          {/* Shipping Information */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="facilityName">Facility Name</Label>
                  <Input
                    id="facilityName"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="Enter facility name"
                  />
                </div>
                <div>
                  <Label htmlFor="shippingContactName">Shipping Contact Name</Label>
                  <Input
                    id="shippingContactName"
                    value={shippingContactName}
                    onChange={(e) => setShippingContactName(e.target.value)}
                    placeholder="Enter contact name"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="shippingAddress">Shipping Address</Label>
                <Textarea
                  id="shippingAddress"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter complete shipping address"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="faxNumber">Fax Number</Label>
                  <Input
                    id="faxNumber"
                    value={faxNumber}
                    onChange={(e) => setFaxNumber(e.target.value)}
                    placeholder="Enter fax number (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfCase">Date of Case</Label>
                  <Input
                    id="dateOfCase"
                    type="date"
                    value={dateOfCase}
                    onChange={(e) => setDateOfCase(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="productArrivalDateTime">Product Arrival Date & Time</Label>
                  <Input
                    id="productArrivalDateTime"
                    value={productArrivalDateTime}
                    onChange={(e) => setProductArrivalDateTime(e.target.value)}
                    placeholder="e.g., before 3/1/2025 at 3pm; first available overnight"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="billingDifferent"
                  checked={billingDifferent}
                  onChange={(e) => setBillingDifferent(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="billingDifferent">Billing information is different from shipping information</Label>
              </div>
              
              {billingDifferent && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="billingFacilityName">Facility Name</Label>
                      <Input
                        id="billingFacilityName"
                        value={billingFacilityName}
                        onChange={(e) => setBillingFacilityName(e.target.value)}
                        placeholder="Enter billing facility name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingContactName">Billing Contact Name</Label>
                      <Input
                        id="billingContactName"
                        value={billingContactName}
                        onChange={(e) => setBillingContactName(e.target.value)}
                        placeholder="Enter billing contact name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="billingAddress">Billing Address</Label>
                    <Textarea
                      id="billingAddress"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="Enter complete billing address"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="billingPhoneNumber">Phone Number</Label>
                      <Input
                        id="billingPhoneNumber"
                        value={billingPhoneNumber}
                        onChange={(e) => setBillingPhoneNumber(e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingFaxNumber">Fax Number</Label>
                      <Input
                        id="billingFaxNumber"
                        value={billingFaxNumber}
                        onChange={(e) => setBillingFaxNumber(e.target.value)}
                        placeholder="Enter fax number (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="billingEmailAddress">Email Address</Label>
                      <Input
                        id="billingEmailAddress"
                        type="email"
                        value={billingEmailAddress}
                        onChange={(e) => setBillingEmailAddress(e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Order Details</CardTitle>
              <Button onClick={addOrderItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderItems.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    {orderItems.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOrderItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                      <Label>Product Code</Label>
                      <Input
                        value={item.productCode}
                        onChange={(e) => updateOrderItem(item.id, "productCode", e.target.value)}
                        placeholder="e.g., CAA-48"
                      />
                    </div>
                    <div>
                      <Label>Manufacturer</Label>
                      <Select
                        value={item.manufacturer}
                        onValueChange={(value) => updateOrderItem(item.id, "manufacturer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select manufacturer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CompleteAA">CompleteAA</SelectItem>
                          <SelectItem value="LifeNet Health">LifeNet Health</SelectItem>
                          <SelectItem value="Musculoskeletal Transplant Foundation">MTF</SelectItem>
                          <SelectItem value="AlloSource">AlloSource</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cost Per Unit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.costPerUnit}
                        onChange={(e) => updateOrderItem(item.id, "costPerUnit", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(item.id, "quantity", e.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label>Total Cost</Label>
                      <div className="flex items-center h-10 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                        {formatCurrency(calculateTotalCost(item.costPerUnit, item.quantity))}
                      </div>
                    </div>
                    <div>
                      <Label>Order Type</Label>
                      <Select
                        value={item.orderType}
                        onValueChange={(value) => updateOrderItem(item.id, "orderType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Direct Order">Direct Order</SelectItem>
                          <SelectItem value="Consignment">Consignment</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <div>
                  <Label htmlFor="purchaseOrderNumber">Purchase Order Number</Label>
                  <Input
                    id="purchaseOrderNumber"
                    value={purchaseOrderNumber}
                    onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                    placeholder="Enter PO number (optional)"
                    className="mt-1"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Grand Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(calculateGrandTotal())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button onClick={generatePDF} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {/* Footer Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="font-medium">Email completed form to Orders@RxWound.com</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Order Cut Off Time</strong> – 4pm EST (Any order submitted after 4pm EST may be processed the next business day)</p>
                  <p>Accounts with past due balance will require approval from accounting department before orders are processed</p>
                  <p>Delivery delays are always possible. To ensure product arrives promptly for cases, please consider placing all orders at least 2-3 days before date of surgery.</p>
                  <p>Account is responsible for cost of any lost product after delivery is successfully made</p>
                </div>
                <p className="text-xs text-gray-500 mt-4">REV3.1</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}