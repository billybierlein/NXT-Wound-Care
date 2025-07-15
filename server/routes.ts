import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertPatientSchema, insertPatientTreatmentSchema } from "@shared/schema";
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

  // Patient Timeline routes
  app.post('/api/patients/:patientId/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      const timelineData = req.body;
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure eventDate is a proper Date object
      if (timelineData.eventDate && typeof timelineData.eventDate === 'string') {
        timelineData.eventDate = new Date(timelineData.eventDate);
      }
      
      const event = await storage.createPatientTimelineEvent({
        ...timelineData,
        patientId,
        userId
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating timeline event:", error);
      res.status(500).json({ message: "Failed to create timeline event" });
    }
  });

  app.get('/api/patients/:patientId/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const events = await storage.getPatientTimelineEvents(patientId, userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching timeline events:", error);
      res.status(500).json({ message: "Failed to fetch timeline events" });
    }
  });

  app.put('/api/patients/:patientId/timeline/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure eventDate is a proper Date object
      const updateData = req.body;
      if (updateData.eventDate && typeof updateData.eventDate === 'string') {
        updateData.eventDate = new Date(updateData.eventDate);
      }
      
      const event = await storage.updatePatientTimelineEvent(eventId, updateData, userId);
      if (!event) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error updating timeline event:", error);
      res.status(500).json({ message: "Failed to update timeline event" });
    }
  });

  app.delete('/api/patients/:patientId/timeline/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const success = await storage.deletePatientTimelineEvent(eventId, userId);
      if (!success) {
        return res.status(404).json({ message: "Timeline event not found" });
      }
      
      res.json({ message: "Timeline event deleted successfully" });
    } catch (error) {
      console.error("Error deleting timeline event:", error);
      res.status(500).json({ message: "Failed to delete timeline event" });
    }
  });

  // CSV export endpoint
  app.get('/api/patients/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const statusFilter = req.query.status;
      let patients = await storage.getPatients(userId);
      
      // Filter by status if specified
      if (statusFilter === 'ivr-approved') {
        patients = patients.filter(patient => 
          patient.patientStatus?.toLowerCase() === 'ivr approved'
        );
      } else if (statusFilter === 'non-approved') {
        patients = patients.filter(patient => 
          patient.patientStatus?.toLowerCase() !== 'ivr approved'
        );
      }
      
      const headers = ['First Name', 'Last Name', 'Date of Birth', 'Phone Number', 'Insurance', 'Wound Type', 'Wound Size', 'Referral Source', 'Sales Rep', 'Patient Status', 'Notes', 'Date Added'];
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
            patient.patientStatus || 'Evaluation Stage',
            `"${patient.notes || ''}"`,
            patient.createdAt?.toISOString().split('T')[0] || ''
          ].join(',');
        })
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="woundcare-patients-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ message: "Failed to export CSV" });
    }
  });

  // Sales Rep routes
  app.post('/api/sales-reps', isAuthenticated, async (req: any, res) => {
    try {
      const { name, email, isActive, commissionRate } = req.body;
      const salesRep = await storage.createSalesRep({ name, email, isActive, commissionRate });
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
      const { name, email, isActive, commissionRate } = req.body;
      const salesRep = await storage.updateSalesRep(id, { name, email, isActive, commissionRate });
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

  // Patient Treatment routes
  app.post('/api/patients/:patientId/treatments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      
      // Verify patient belongs to user and has IVR approved status
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      if (patient.patientStatus?.toLowerCase() !== 'ivr approved') {
        return res.status(400).json({ message: "Patient must have IVR approved status for treatments" });
      }
      
      // Ensure treatmentDate is a proper Date object
      const treatmentData = req.body;
      if (treatmentData.treatmentDate && typeof treatmentData.treatmentDate === 'string') {
        treatmentData.treatmentDate = new Date(treatmentData.treatmentDate);
      }
      
      const validation = insertPatientTreatmentSchema.safeParse(treatmentData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }
      
      const treatment = await storage.createPatientTreatment({
        ...validation.data,
        patientId,
        userId
      });
      
      res.status(201).json(treatment);
    } catch (error) {
      console.error("Error creating treatment:", error);
      res.status(500).json({ message: "Failed to create treatment" });
    }
  });

  app.get('/api/patients/:patientId/treatments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const treatments = await storage.getPatientTreatments(patientId, userId);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  app.put('/api/patients/:patientId/treatments/:treatmentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure treatmentDate is a proper Date object if provided
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
      
      const treatment = await storage.updatePatientTreatment(treatmentId, validation.data, userId);
      if (!treatment) {
        return res.status(404).json({ message: "Treatment not found" });
      }
      
      res.json(treatment);
    } catch (error) {
      console.error("Error updating treatment:", error);
      res.status(500).json({ message: "Failed to update treatment" });
    }
  });

  app.delete('/api/patients/:patientId/treatments/:treatmentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      const treatmentId = parseInt(req.params.treatmentId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      const success = await storage.deletePatientTreatment(treatmentId, userId);
      if (!success) {
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
