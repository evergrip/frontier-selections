import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    // No auth required - this is for public invite validation
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const invitationId = body.invitation_id;

    if (!invitationId) {
      return Response.json({ 
        valid: false, 
        error: "missing_invite", 
        message: "No invitation token provided" 
      }, { status: 400 });
    }

    // Use service role to read invite without auth
    const serviceBase44 = base44.asServiceRole;
    const ipAddress = req.headers.get("X-Forwarded-For") || req.headers.get("CF-Connecting-IP") || "unknown";
    
    const existingInvites = await serviceBase44.entities.CustomerInvitation.filter({ id: invitationId });
    
    if (existingInvites.length === 0) {
      // Log failed validation attempt
      await serviceBase44.entities.AuditLog.create({
        target_type: 'customer_invitation',
        target_id: invitationId,
        action: 'invite_validation_failed',
        action_type: 'invite_validation_failed',
        description: `Invalid invitation ID attempted: ${invitationId}`,
        actor_user_id: null,
        actor_name: 'Unknown',
        actor_role: 'anonymous',
        ip_address: ipAddress,
        severity: 'medium'
      });
      
      return Response.json({ 
        valid: false, 
        error: "invalid_invite", 
        message: "This invitation link is invalid or does not exist." 
      }, { status: 404 });
    }

    const invitation = existingInvites[0];
    const now = new Date();
    const expiryDate = new Date(invitation.expiry_date);

    // Check if expired
    if (now > expiryDate) {
      return Response.json({ 
        valid: false, 
        error: "expired_invite", 
        message: "This invitation has expired. Please contact Frontier Building Group for a new invitation.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          customer_name: invitation.customer_name,
          project_names: invitation.project_names,
          expired_date: invitation.expiry_date
        }
      }, { status: 410 });
    }

    // Check if cancelled or deactivated
    if (invitation.status === 'Cancelled') {
      return Response.json({ 
        valid: false, 
        error: "cancelled_invite", 
        message: "This invitation has been cancelled. Please contact Frontier Building Group.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          customer_name: invitation.customer_name,
          project_names: invitation.project_names
        }
      }, { status: 403 });
    }

    if (invitation.status === 'Deactivated') {
      return Response.json({ 
        valid: false, 
        error: "deactivated_invite", 
        message: "This invitation has been deactivated. Please contact Frontier Building Group.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          customer_name: invitation.customer_name,
          project_names: invitation.project_names
        }
      }, { status: 403 });
    }

    // Check if already accepted (user account created)
    if (invitation.status === 'Active' || invitation.status === 'Account created') {
      if (invitation.user_id) {
        return Response.json({ 
          valid: true, 
          already_accepted: true,
          message: "This invitation has already been accepted. Please log in to access your projects.",
          invitation: {
            id: invitation.id,
            email: invitation.email,
            customer_name: invitation.customer_name,
            project_names: invitation.project_names,
            status: invitation.status
          }
        });
      }
    }

    // Log successful validation and update invite stats
    const nowISO = now.toISOString();
    const openCount = (invitation.opened_count || 0) + 1;
    
    await serviceBase44.entities.CustomerInvitation.update(invitationId, {
      status: 'Invitation opened',
      first_opened_date: invitation.first_opened_date || nowISO,
      last_opened_date: nowISO,
      opened_count: openCount
    });

    await serviceBase44.entities.AuditLog.create({
      target_type: 'customer_invitation',
      target_id: invitationId,
      action: 'invite_link_clicked',
      action_type: 'invite_link_clicked',
      description: `Invitation link clicked by ${invitation.email} (click #${openCount})`,
      actor_user_id: null,
      actor_name: invitation.email,
      actor_role: 'customer',
      project_id: (invitation.project_ids || [])[0],
      ip_address: ipAddress,
      severity: 'low'
    });

    // Valid invite - return invite details
    return Response.json({ 
      valid: true, 
      already_accepted: false,
      message: "Invitation is valid",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        customer_name: invitation.customer_name,
        project_names: invitation.project_names,
        status: invitation.status,
        expiry_date: invitation.expiry_date
      }
    });

  } catch (error) {
    return Response.json({ 
      valid: false, 
      error: "server_error", 
      message: "Unable to validate invitation. Please try again or contact support.",
      details: error.message 
    }, { status: 500 });
  }
});