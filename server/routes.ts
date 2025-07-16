import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import { insertPatientSchema, insertPatientTreatmentSchema, insertProviderSchema, insertInvoiceSchema } from "@shared/schema";
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

  // Get all treatments for all users (admin dashboard)
  app.get('/api/treatments/all', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatments = await storage.getAllTreatments(userId, userEmail);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching all treatments:", error);
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

  app.post('/api/sales-reps', requireAuth, async (req: any, res) => {
    try {
      const salesRepData = req.body;
      const salesRep = await storage.createSalesRep(salesRepData);
      res.status(201).json(salesRep);
    } catch (error) {
      console.error("Error creating sales rep:", error);
      res.status(500).json({ message: "Failed to create sales rep" });
    }
  });

  app.get('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
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

  app.put('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const salesRepData = req.body;
      const salesRep = await storage.updateSalesRep(id, salesRepData);
      if (!salesRep) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json(salesRep);
    } catch (error) {
      console.error("Error updating sales rep:", error);
      res.status(500).json({ message: "Failed to update sales rep" });
    }
  });

  app.delete('/api/sales-reps/:id', requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSalesRep(id);
      if (!success) {
        return res.status(404).json({ message: "Sales rep not found" });
      }
      res.json({ message: "Sales rep deleted successfully" });
    } catch (error) {
      console.error("Error deleting sales rep:", error);
      res.status(500).json({ message: "Failed to delete sales rep" });
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

  app.post('/api/patients/:patientId/timeline', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const firstName = req.user.firstName;
      const lastName = req.user.lastName;
      const patientId = parseInt(req.params.patientId);
      const timelineData = req.body;
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      // Ensure eventDate is a proper Date object
      if (timelineData.eventDate && typeof timelineData.eventDate === 'string') {
        timelineData.eventDate = new Date(timelineData.eventDate);
      }
      
      // Add username to the event data
      const username = firstName && lastName ? `${firstName} ${lastName}` : userEmail;
      
      const event = await storage.createPatientTimelineEvent({
        ...timelineData,
        patientId,
        userId,
        createdBy: username
      });
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating timeline event:", error);
      res.status(500).json({ message: "Failed to create timeline event" });
    }
  });

  app.put('/api/patients/:patientId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
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

  app.delete('/api/patients/:patientId/timeline/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const patientId = parseInt(req.params.patientId);
      const eventId = parseInt(req.params.eventId);
      
      // Verify patient belongs to user
      const patient = await storage.getPatientById(patientId, userId, userEmail);
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

  // Direct treatment deletion endpoint for treatments page
  app.delete('/api/treatments/:treatmentId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const treatmentId = parseInt(req.params.treatmentId);
      
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

  // Provider routes
  app.get('/api/providers', requireAuth, async (req: any, res) => {
    try {
      const providers = await storage.getProviders();
      res.json(providers);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Failed to fetch providers" });
    }
  });

  app.get('/api/providers/stats', requireAuth, async (req: any, res) => {
    try {
      const providersWithStats = await storage.getProviderStats();
      res.json(providersWithStats);
    } catch (error) {
      console.error("Error fetching provider stats:", error);
      res.status(500).json({ message: "Failed to fetch provider stats" });
    }
  });

  app.post('/api/providers', requireAuth, async (req: any, res) => {
    try {
      const validation = insertProviderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const provider = await storage.createProvider(validation.data);
      res.json(provider);
    } catch (error) {
      console.error("Error creating provider:", error);
      res.status(500).json({ message: "Failed to create provider" });
    }
  });

  app.put('/api/providers/:id', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const validation = insertProviderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const provider = await storage.updateProvider(providerId, validation.data);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      res.json(provider);
    } catch (error) {
      console.error("Error updating provider:", error);
      res.status(500).json({ message: "Failed to update provider" });
    }
  });

  app.delete('/api/providers/:id', requireAuth, async (req: any, res) => {
    try {
      const providerId = parseInt(req.params.id);
      const deleted = await storage.deleteProvider(providerId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      res.json({ message: "Provider deleted successfully" });
    } catch (error) {
      console.error("Error deleting provider:", error);
      res.status(500).json({ message: "Failed to delete provider" });
    }
  });

  // Invoice routes
  app.get('/api/invoices', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const invoices = await storage.getInvoices(userId, userEmail);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post('/api/invoices', requireAuth, async (req: any, res) => {
    try {
      // Handle date conversion - convert string to Date object if needed
      const invoiceData = { ...req.body };
      
      console.log('Original invoice data dates:', {
        invoiceDate: invoiceData.invoiceDate,
        payableDate: invoiceData.payableDate,
        treatmentStartDate: invoiceData.treatmentStartDate
      });
      
      // No need to convert dates since they come as YYYY-MM-DD strings and database expects date type
      // The dates will be handled properly by Drizzle ORM
      
      const validation = insertInvoiceSchema.safeParse(invoiceData);
      
      if (!validation.success) {
        console.log('Validation error:', validation.error);
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const invoice = await storage.createInvoice(validation.data);
      
      // Automatically create treatment record from invoice data
      try {
        // Find patient by name to get patientId
        const [firstName, lastName] = invoice.patientName.split(' ', 2);
        const patients = await storage.getPatients(req.user.id, req.user.email);
        const patient = patients.find(p => 
          p.firstName === firstName && p.lastName === lastName
        );
        
        if (patient) {
          // Create treatment with shared invoice data, leaving treatment-specific fields blank
          const treatmentData = {
            patientId: patient.id,
            userId: req.user.id,
            treatmentDate: new Date(invoice.treatmentStartDate),
            treatmentNumber: 1, // Will be auto-assigned by database
            graftName: invoice.graft,
            pricePerSqCm: "0", // Leave blank for later completion
            woundSizeAtTreatment: invoice.size,
            totalRevenue: invoice.totalBillable,
            totalInvoice: invoice.totalInvoice,
            totalCommission: invoice.totalCommission,
            repCommission: invoice.repCommission,
            nxtCommission: invoice.nxtCommission,
            qCode: invoice.productCode,
            status: "active",
            actingProvider: invoice.provider,
            notes: null // Leave blank for later completion
          };
          
          await storage.createPatientTreatment(treatmentData);
          console.log(`Auto-created treatment for patient ${patient.firstName} ${patient.lastName} from invoice ${invoice.invoiceNo}`);
        } else {
          console.warn(`Patient not found for invoice ${invoice.invoiceNo}: ${invoice.patientName}`);
        }
      } catch (treatmentError) {
        console.error("Error creating automatic treatment:", treatmentError);
        // Don't fail the invoice creation if treatment creation fails
      }
      
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.get('/api/invoices/:id', requireAuth, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoiceById(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.put('/api/invoices/:id', requireAuth, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      
      // Dates come as YYYY-MM-DD strings and will be handled by Drizzle ORM
      const invoiceData = { ...req.body };
      
      console.log('PUT invoice data dates:', {
        invoiceDate: invoiceData.invoiceDate,
        payableDate: invoiceData.payableDate,
        treatmentStartDate: invoiceData.treatmentStartDate
      });
      
      const validation = insertInvoiceSchema.safeParse(invoiceData);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: fromZodError(validation.error).message 
        });
      }

      const invoice = await storage.updateInvoice(invoiceId, validation.data);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete('/api/invoices/:id', requireAuth, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const deleted = await storage.deleteInvoice(invoiceId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.patch('/api/invoices/:id/status', requireAuth, async (req: any, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['open', 'payable', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'open', 'payable', or 'closed'" });
      }
      
      const invoice = await storage.updateInvoiceStatus(invoiceId, status);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}