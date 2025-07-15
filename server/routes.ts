import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertPatientSchema } from "@shared/schema";
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

  // Patient routes
  app.post('/api/patients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertPatientSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.createPatient(validation.data, userId);
      res.json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.get('/api/patients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { search, salesRep, referralSource } = req.query;
      
      const patients = await storage.searchPatients(
        userId,
        search as string,
        salesRep as string,
        referralSource as string
      );
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.get('/api/patients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.id);
      
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  app.put('/api/patients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.id);
      
      const validation = insertPatientSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.updatePatient(patientId, validation.data, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  app.delete('/api/patients/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.id);
      
      const success = await storage.deletePatient(patientId, userId);
      if (!success) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json({ message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient:", error);
      res.status(500).json({ message: "Failed to delete patient" });
    }
  });

  // CSV export endpoint
  app.get('/api/patients/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patients = await storage.getPatients(userId);
      
      const headers = ['First Name', 'Last Name', 'Date of Birth', 'Phone Number', 'Insurance', 'Wound Type', 'Wound Size', 'Referral Source', 'Sales Rep', 'Notes', 'Date Added'];
      const csvContent = [
        headers.join(','),
        ...patients.map(patient => {
          // Convert YYYY-MM-DD to MM/DD/YYYY for CSV export
          let displayDate = patient.dateOfBirth;
          if (displayDate && displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = displayDate.split('-');
            displayDate = `${month}/${day}/${year}`;
          }
          
          return [
            patient.firstName,
            patient.lastName,
            displayDate,
            patient.phoneNumber,
            patient.insurance === "other" && patient.customInsurance ? patient.customInsurance : patient.insurance,
            patient.woundType || 'Not specified',
            patient.woundSize ? `${patient.woundSize} sq cm` : 'Not specified',
            patient.referralSource,
            patient.salesRep,
            `"${patient.notes || ''}"`,
            patient.createdAt?.toISOString().split('T')[0] || ''
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
