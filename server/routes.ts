import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertLeadSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Lead routes
  app.post('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertLeadSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const lead = await storage.createLead(validation.data, userId);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.get('/api/leads', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { search, salesRep, referralSource } = req.query;
      
      const leads = await storage.searchLeads(
        userId,
        search as string,
        salesRep as string,
        referralSource as string
      );
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadId = parseInt(req.params.id);
      
      const lead = await storage.getLeadById(leadId, userId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.put('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadId = parseInt(req.params.id);
      
      const validation = insertLeadSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const lead = await storage.updateLead(leadId, validation.data, userId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.delete('/api/leads/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadId = parseInt(req.params.id);
      
      const success = await storage.deleteLead(leadId, userId);
      if (!success) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json({ message: "Lead deleted successfully" });
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ message: "Failed to delete lead" });
    }
  });

  // CSV export endpoint
  app.get('/api/leads/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leads = await storage.getLeads(userId);
      
      const headers = ['First Name', 'Last Name', 'Date of Birth', 'Phone Number', 'Insurance', 'Wound Type', 'Wound Size', 'Referral Source', 'Sales Rep', 'Notes', 'Date Added'];
      const csvContent = [
        headers.join(','),
        ...leads.map(lead => {
          // Convert YYYY-MM-DD to MM/DD/YYYY for CSV export
          let displayDate = lead.dateOfBirth;
          if (displayDate && displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = displayDate.split('-');
            displayDate = `${month}/${day}/${year}`;
          }
          
          return [
            lead.firstName,
            lead.lastName,
            displayDate,
            lead.phoneNumber,
            lead.insurance === "other" && lead.customInsurance ? lead.customInsurance : lead.insurance,
            lead.woundType || 'Not specified',
            lead.woundSize ? `${lead.woundSize} sq cm` : 'Not specified',
            lead.referralSource,
            lead.salesRep,
            `"${lead.notes || ''}"`,
            lead.createdAt?.toISOString().split('T')[0] || ''
          ].join(',');
        })
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="woundcare-leads-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Sales Rep routes
  app.post('/api/sales-reps', isAuthenticated, async (req: any, res) => {
    try {
      const { name, email, isActive } = req.body;
      const salesRep = await storage.createSalesRep({ name, email, isActive });
      res.status(201).json(salesRep);
    } catch (error) {
      console.error("Error creating sales rep:", error);
      res.status(500).json({ message: "Failed to create sales rep" });
    }
  });

  app.get('/api/sales-reps', isAuthenticated, async (req: any, res) => {
    try {
      const salesReps = await storage.getSalesReps();
      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching sales reps:", error);
      res.status(500).json({ message: "Failed to fetch sales reps" });
    }
  });

  app.get('/api/sales-reps/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const salesRep = await storage.getSalesRepById(id);
      if (!salesRep) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json(salesRep);
    } catch (error) {
      console.error("Error fetching sales rep:", error);
      res.status(500).json({ message: "Failed to fetch sales rep" });
    }
  });

  app.put('/api/sales-reps/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, email, isActive } = req.body;
      const salesRep = await storage.updateSalesRep(id, { name, email, isActive });
      if (!salesRep) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json(salesRep);
    } catch (error) {
      console.error("Error updating sales rep:", error);
      res.status(500).json({ message: "Failed to update sales rep" });
    }
  });

  app.delete('/api/sales-reps/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSalesRep(id);
      if (!success) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json({ message: "Sales rep deactivated successfully" });
    } catch (error) {
      console.error("Error deleting sales rep:", error);
      res.status(500).json({ message: "Failed to delete sales rep" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
