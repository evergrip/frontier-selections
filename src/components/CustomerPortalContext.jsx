import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";

const CustomerPortalContext = createContext(null);

export function CustomerPortalProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [customerPortalMode, setCustomerPortalMode] = useState(null); // 'preview' | 'act' | null
  const [customerPortalContext, setCustomerPortalContext] = useState(null); // { project, customer, reason? }
  const [enteringMode, setEnteringMode] = useState(false);
  const [previousLocation, setPreviousLocation] = useState(null);

  // Log entry/exit for audit trail
  useEffect(() => {
    if (customerPortalMode && customerPortalContext) {
      logEntry();
    }
    return () => {
      if (customerPortalMode && customerPortalContext) {
        logExit();
      }
    };
  }, [customerPortalMode, customerPortalContext?.project?.id, customerPortalContext?.customer?.id]);

  const logEntry = async () => {
    try {
      const { project, customer, reason } = customerPortalContext;
      await base44.functions.invoke("impersonation", {
        action: "log_customer_portal_entry",
        mode: customerPortalMode,
        project_id: project.id,
        customer_user_id: customer.user_id,
        customer_name: customer.customer_name,
        reason: customerPortalMode === 'act' ? reason : null
      });
    } catch (error) {
      console.error("Failed to log customer portal entry:", error);
    }
  };

  const logExit = async () => {
    try {
      const { project, customer } = customerPortalContext;
      await base44.functions.invoke("impersonation", {
        action: "log_customer_portal_exit",
        mode: customerPortalMode,
        project_id: project.id,
        customer_user_id: customer.user_id
      });
    } catch (error) {
      console.error("Failed to log customer portal exit:", error);
    }
  };

  const enterPreviewMode = useCallback(async (project, customer) => {
    setEnteringMode(true);
    try {
      setPreviousLocation({ pathname: location.pathname, state: location.state });
      setCustomerPortalMode('preview');
      setCustomerPortalContext({ project, customer });
      
      // Navigate to customer portal
      navigate(`/portal/project/${project.id}`, { replace: true });
    } finally {
      setEnteringMode(false);
    }
  }, [location, navigate]);

  const enterActMode = useCallback(async (project, customer, reason) => {
    setEnteringMode(true);
    try {
      setPreviousLocation({ pathname: location.pathname, state: location.state });
      setCustomerPortalMode('act');
      setCustomerPortalContext({ project, customer, reason });
      
      // Navigate to customer portal
      navigate(`/portal/project/${project.id}`, { replace: true });
    } finally {
      setEnteringMode(false);
    }
  }, [location, navigate]);

  const exitCustomerPortal = useCallback(() => {
    if (previousLocation) {
      navigate(previousLocation.pathname, { replace: true, state: previousLocation.state });
    } else {
      navigate(`/projects/${customerPortalContext?.project?.id}`, { replace: true });
    }
    setCustomerPortalMode(null);
    setCustomerPortalContext(null);
    setPreviousLocation(null);
  }, [previousLocation, customerPortalContext, navigate]);

  const isPreviewMode = customerPortalMode === 'preview';
  const isActMode = customerPortalMode === 'act';
  const isInCustomerPortal = !!customerPortalMode;
  
  const value = {
    customerPortalMode,
    customerPortalContext,
    isPreviewMode,
    isActMode,
    isInCustomerPortal,
    isReadOnly: isPreviewMode,
    enterPreviewMode,
    enterActMode,
    exitCustomerPortal,
    enteringMode
  };

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortal() {
  const context = useContext(CustomerPortalContext);
  if (!context) {
    throw new Error("useCustomerPortal must be used within CustomerPortalProvider");
  }
  return context;
}