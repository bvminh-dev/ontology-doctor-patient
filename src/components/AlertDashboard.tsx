'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, CheckCircle, XCircle, Bell } from 'lucide-react';

interface Alert {
  id: string;
  ruleType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  entityUri: string;
  actions?: Array<{
    label: string;
    type: string;
    target?: string;
  }>;
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface AlertDashboardProps {
  refreshTrigger?: number;
}

export default function AlertDashboard({ refreshTrigger = 0 }: AlertDashboardProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary>({
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ontology/reason');
      const result = await response.json();

      if (result.success) {
        setAlerts(result.data.alerts);
        setSummary(result.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [refreshTrigger]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#E41E3F] text-white border-[#C80A28]';
      case 'warning':
        return 'bg-[#F7B928] text-[#1C2B33] border-[#E5A000]';
      case 'info':
        return 'bg-[#0064E0] text-white border-[#0143B5]';
      default:
        return 'bg-[#F7F8FA] text-[#1C2B33] border-[#DEE3E9]';
    }
  };

  const handleAction = (action: any) => {
    // Handle action (navigate, assign, etc.)
    console.log('Action:', action);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alerts & Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#5D6C7B]">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-[#E41E3F] bg-[rgba(228,30,63,0.1)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-8 h-8 text-[#E41E3F]" />
              <div>
                <p className="text-2xl font-bold text-[#E41E3F]">{summary.critical}</p>
                <p className="text-xs text-[#65676B]">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#F7B928] bg-[rgba(247,185,40,0.1)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-8 h-8 text-[#F7B928]" />
              <div>
                <p className="text-2xl font-bold text-[#E41E3F]">{summary.warning}</p>
                <p className="text-xs text-[#65676B]">Warning</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#0064E0] bg-[rgba(0,100,224,0.1)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Info className="w-8 h-8 text-[#0064E0]" />
              <div>
                <p className="text-2xl font-bold text-[#1C2B33]">{summary.info}</p>
                <p className="text-xs text-[#65676B]">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#31A24C] bg-[rgba(49,162,76,0.1)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-[#31A24C]" />
              <div>
                <p className="text-2xl font-bold text-[#1C2B33]">{summary.total}</p>
                <p className="text-xs text-[#65676B]">Total Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Active Alerts</CardTitle>
          <Button
            onClick={fetchAlerts}
            variant="outline"
            size="sm"
            className="rounded-[100px]"
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-[#31A24C] mx-auto mb-4" />
              <p className="text-[#5D6C7B]">All systems normal. No active alerts.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-2 ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold mb-1">{alert.title}</h4>
                      <p className="text-sm opacity-90 mb-3">{alert.description}</p>
                      {alert.actions && alert.actions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {alert.actions.map((action, index) => (
                            <Button
                              key={index}
                              onClick={() => handleAction(action)}
                              size="sm"
                              variant="outline"
                              className="rounded-[100px] bg-white/20 hover:bg-white/30 border-white/40"
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
