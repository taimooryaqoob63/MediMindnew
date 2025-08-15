/**
 * Human Escalation API Routes
 * Handles supervisor review and escalation management
 */

import express from 'express';
import { humanEscalationService } from '../services/humanEscalationService';
import { citationEnforcementService } from '../services/citationEnforcementService';

const router = express.Router();

// Get pending escalations for supervisor dashboard
router.get('/pending', async (req, res) => {
  try {
    const supervisorId = req.user?.id; // Assumes auth middleware sets user
    const escalations = await humanEscalationService.getPendingEscalations(supervisorId);
    
    res.json({
      success: true,
      data: {
        escalations,
        count: escalations.length,
        stats: humanEscalationService.getEscalationStats()
      }
    });
  } catch (error) {
    console.error('Error fetching pending escalations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch escalations'
    });
  }
});

// Review and respond to escalation
router.post('/review/:escalationId', async (req, res) => {
  try {
    const { escalationId } = req.params;
    const supervisorId = req.user?.id || 'system';
    const {
      approved,
      modifiedResponse,
      additionalSources,
      confidence,
      reviewNotes,
      followUpRequired
    } = req.body;

    const result = await humanEscalationService.reviewEscalation(escalationId, supervisorId, {
      approved,
      modifiedResponse,
      additionalSources,
      confidence,
      reviewNotes,
      followUpRequired
    });

    if (result.success) {
      res.json({
        success: true,
        data: {
          escalationId,
          finalResponse: result.finalResponse,
          message: 'Escalation reviewed successfully'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Escalation not found'
      });
    }
  } catch (error) {
    console.error('Error reviewing escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review escalation'
    });
  }
});

// Get escalation statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = humanEscalationService.getEscalationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching escalation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Get citation compliance report
router.get('/citations/compliance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const timeRange = {
      start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate as string) : new Date()
    };

    const report = citationEnforcementService.generateComplianceReport(timeRange);
    
    res.json({
      success: true,
      data: {
        report,
        timeRange,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

// Get audit trail for specific citations
router.get('/citations/audit/:sourceIds', async (req, res) => {
  try {
    const { sourceIds } = req.params;
    const sourceIdArray = sourceIds.split(',');
    
    const auditTrail = citationEnforcementService.getAuditTrail(sourceIdArray);
    
    res.json({
      success: true,
      data: {
        auditTrail,
        sourceCount: sourceIdArray.length,
        entryCount: auditTrail.length
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail'
    });
  }
});

export { router as escalationRoutes };