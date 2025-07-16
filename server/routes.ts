import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { insertPatientSchema, insertPatientTreatmentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // Test route for authenticated user
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Patient routes
  app.post('/api/patients', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validation = insertPatientSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.createPatient(validation.data, userId);
      
      // Create initial timeline event for patient creation
      await storage.createPatientTimelineEvent({
        patientId: patient.id,
        eventType: 'created',
        title: 'Patient Created',
        description: `Patient ${patient.firstName} ${patient.lastName} was added to the system`,
        eventDate: new Date(),
        userId: userId
      });
      
      res.json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.get('/api/patients', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { search, salesRep, referralSource } = req.query;
      
      const patients = await storage.searchPatients(
        userId,
        search as string,
        salesRep as string,
        referralSource as string,
        userEmail
      );
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  // Get all treatments for a user (for dashboard statistics)
  app.get('/api/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatments = await storage.getAllTreatments(userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  app.get('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patient = await storage.getPatientById(parseInt(req.params.id), userId, userEmail);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  app.put('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const validation = insertPatientSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const patient = await storage.updatePatient(parseInt(req.params.id), validation.data, userId, userEmail);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient:", error);
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  app.delete('/api/patients/:id', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const success = await storage.deletePatient(parseInt(req.params.id), userId, userEmail);
      
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
  app.get('/api/patients/export/csv', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { search, salesRep, referralSource } = req.query;
      
      const patients = await storage.searchPatients(
        userId,
        search as string,
        salesRep as string,
        referralSource as string,
        userEmail
      );
      
      // Create CSV headers
      const csvHeaders = [
        'First Name',
        'Last Name', 
        'Date of Birth',
        'Phone Number',
        'Insurance',
        'Custom Insurance',
        'Referral Source',
        'Sales Rep',
        'Wound Type',
        'Wound Size (sq cm)',
        'Patient Status',
        'Notes',
        'Created At'
      ];
      
      // Create CSV rows
      const csvRows = patients.map(patient => [
        patient.firstName,
        patient.lastName,
        patient.dateOfBirth,
        patient.phoneNumber,
        patient.insurance,
        patient.customInsurance || '',
        patient.referralSource,
        patient.salesRep,
        patient.woundType || '',
        patient.woundSize || '',
        patient.patientStatus || '',
        patient.notes || '',
        patient.createdAt?.toISOString().split('T')[0] || ''
      ]);
      
      // Combine headers and rows
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting patients to CSV:", error);
      res.status(500).json({ message: "Failed to export patients to CSV" });
    }
  });

  // Sales Rep routes
  app.get('/api/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const salesReps = await storage.getSalesReps();
      res.json(salesReps);
    } catch (error) {
      console.error("Error fetching sales reps:", error);
      res.status(500).json({ message: "Failed to fetch sales reps" });
    }
  });

  // Timeline routes
  app.get('/api/patients/:patientId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = parseInt(req.params.patientId);
      const events = await storage.getPatientTimelineEvents(patientId, userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching timeline events:", error);
      res.status(500).json({ message: "Failed to fetch timeline events" });
    }
  });

  // Treatment routes
  app.get('/api/patients/:patientId/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatments = await storage.getPatientTreatments(patientId, userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  app.post('/api/patients/:patientId/treatments', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      
      // Verify patient belongs to user and has IVR approved status
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      if (patient.patientStatus?.toLowerCase() !== 'ivr approved') {
        return res.status(400).json({ message: "Patient must have IVR approved status for treatments" });
      }
      
      // Handle date conversion - convert string to Date object if needed
      const treatmentData = {
        ...req.body,
        patientId,
        userId
      };
      
      if (treatmentData.treatmentDate && typeof treatmentData.treatmentDate === 'string') {
        treatmentData.treatmentDate = new Date(treatmentData.treatmentDate);
      }
      
      const validation = insertPatientTreatmentSchema.safeParse(treatmentData);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const treatment = await storage.createPatientTreatment(validation.data);
      res.status(201).json(treatment);
    } catch (error) {
      console.error("Error creating treatment:", error);
      res.status(500).json({ message: "Failed to create treatment" });
    }
  });

  app.put('/api/patients/:patientId/treatments/:treatmentId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Handle date conversion - convert string to Date object if needed
      const treatmentData = req.body;
      if (treatmentData.treatmentDate && typeof treatmentData.treatmentDate === 'string') {
        treatmentData.treatmentDate = new Date(treatmentData.treatmentDate);
      }
      
      const validation = insertPatientTreatmentSchema.partial().safeParse(treatmentData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }
      
      const treatment = await storage.updatePatientTreatment(treatmentId, validation.data, userId, userEmail);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment:", error);
      res.status(500).json({ message: "Failed to update treatment" });
    }
  });

  app.delete('/api/patients/:patientId/treatments/:treatmentId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const deleted = await storage.deletePatientTreatment(treatmentId, userId, userEmail);
      if (!deleted) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json({ message: "Treatment deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment:", error);
      res.status(500).json({ message: "Failed to delete treatment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}