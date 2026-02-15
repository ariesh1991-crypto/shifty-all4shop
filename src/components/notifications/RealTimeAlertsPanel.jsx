import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, addDays, startOfDay, differenceInHours } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, CheckCircle, X, Clock, Users, Calendar, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function RealTimeAlertsPanel({ isManager = false }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: alerts = [], refetch } = useQuery({
    queryKey: ['realTimeAlerts'],
    queryFn: generateAlerts,
    refetchInterval: 30000, // רענן כל 30 שניות
    enabled: isManager,
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async ({ alertId, action, notes }) => {
      // שמור בהיסטוריה
      await base44.entities.Notification.create({
        user_id: 'system',
        type: 'alert_acknowledged',
        title: `התראה טופלה: ${alertId}`,
        message: `פעולה: ${action}${notes ? ` - ${notes}` : ''}`,
        read: true,
      });
      return { alertId, action };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['realTimeAlerts']);
      setSelectedAlert(null);
      setActionNotes('');
    },
  });

  async function generateAlerts() {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
    const nextWeek = format(addDays(now, 7), 'yyyy-MM-dd');

    const [shifts, employees, vacations, swaps, constraints] = await Promise.all([
      base44.entities.Shift.list(),
      base44.entities.Employee.list(),
      base44.entities.VacationRequest.list('-created_date'),
      base44.entities.SwapRequest.list('-created_date'),
      base44.entities.Constraint.list(),
    ]);

    const alerts = [];
    const activeEmployees = employees.filter(e => e.active);

    // 1. התראות על חוסר בכוח אדם - 48 שעות קדימה
    const upcomingShifts = shifts.filter(s => 
      s.date >= today && 
      s.date <= nextWeek && 
      (!s.assigned_employee_id || s.status === 'בעיה')
    );

    if (upcomingShifts.length > 0) {
      const criticalShifts = upcomingShifts.filter(s => 
        s.date === today || s.date === tomorrow
      );
      
      if (criticalShifts.length > 0) {
        alerts.push({
          id: 'understaffed-critical',
          type: 'critical',
          severity: 'critical',
          icon: <AlertTriangle className="w-5 h-5" />,
          title: `${criticalShifts.length} משמרות קריטיות ללא כיסוי`,
          message: `משמרות להיום/מחר ללא עובד משובץ - דרוש טיפול מיידי`,
          timestamp: now,
          actionable: true,
          details: {
            shifts: criticalShifts.map(s => ({
              date: s.date,
              type: s.shift_type,
              isToday: s.date === today,
            })),
          },
        });
      }

      if (upcomingShifts.length > criticalShifts.length) {
        alerts.push({
          id: 'understaffed-upcoming',
          type: 'warning',
          severity: 'warning',
          icon: <Users className="w-5 h-5" />,
          title: `${upcomingShifts.length} משמרות ללא כיסוי השבוע`,
          message: 'משמרות בשבוע הקרוב שדורשות שיבוץ',
          timestamp: now,
          actionable: true,
          details: {
            shifts: upcomingShifts.map(s => ({
              date: s.date,
              type: s.shift_type,
            })),
          },
        });
      }
    }

    // 2. בקשות חופשה דחופות (פחות מ-48 שעות)
    const urgentVacations = vacations.filter(v => {
      if (v.status !== 'ממתין לאישור') return false;
      const startDate = new Date(v.start_date + 'T00:00:00');
      const hoursUntil = differenceInHours(startDate, now);
      return hoursUntil < 48 && hoursUntil > 0;
    });

    if (urgentVacations.length > 0) {
      alerts.push({
        id: 'urgent-vacation-requests',
        type: 'critical',
        severity: 'critical',
        icon: <Clock className="w-5 h-5" />,
        title: `${urgentVacations.length} בקשות חופשה דחופות`,
        message: 'בקשות המתחילות תוך 48 שעות - דרוש אישור מיידי',
        timestamp: now,
        actionable: true,
        details: {
          requests: urgentVacations.map(v => {
            const emp = employees.find(e => e.id === v.employee_id);
            return {
              id: v.id,
              employee: emp?.full_name,
              startDate: v.start_date,
              endDate: v.end_date,
              type: v.type,
            };
          }),
        },
      });
    }

    // 3. בקשות החלפה ממתינות (יותר מ-3 ימים)
    const pendingSwaps = swaps.filter(s => s.status === 'ממתין לאישור');
    const oldSwaps = pendingSwaps.filter(s => {
      const created = new Date(s.created_date);
      const daysPending = differenceInHours(now, created) / 24;
      return daysPending > 3;
    });

    if (oldSwaps.length > 0) {
      alerts.push({
        id: 'old-swap-requests',
        type: 'warning',
        severity: 'warning',
        icon: <Clock className="w-5 h-5" />,
        title: `${oldSwaps.length} בקשות החלפה ממתינות מעל 3 ימים`,
        message: 'בקשות שדורשות תשומת לב',
        timestamp: now,
        actionable: true,
        details: {
          count: oldSwaps.length,
        },
      });
    }

    // 4. חוסר איזון במשמרות - בדוק את החודש הנוכחי
    const currentMonth = format(now, 'yyyy-MM');
    const monthShifts = shifts.filter(s => s.date?.startsWith(currentMonth) && s.assigned_employee_id);
    
    const employeeShiftCounts = {};
    activeEmployees.forEach(emp => {
      employeeShiftCounts[emp.id] = {
        employee: emp,
        count: monthShifts.filter(s => s.assigned_employee_id === emp.id).length,
      };
    });

    const counts = Object.values(employeeShiftCounts).map(e => e.count);
    if (counts.length > 0) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      
      // אם יש הפרש של יותר מ-4 משמרות
      if (max - min > 4) {
        const overworked = Object.values(employeeShiftCounts)
          .filter(e => e.count >= avg + 2)
          .map(e => e.employee.full_name);
        const underworked = Object.values(employeeShiftCounts)
          .filter(e => e.count <= avg - 2)
          .map(e => e.employee.full_name);

        if (overworked.length > 0 || underworked.length > 0) {
          alerts.push({
            id: 'shift-imbalance',
            type: 'info',
            severity: 'info',
            icon: <TrendingUp className="w-5 h-5" />,
            title: 'חוסר איזון בחלוקת משמרות',
            message: `הפרש של ${max - min} משמרות בין העובדים החודש`,
            timestamp: now,
            actionable: false,
            details: {
              overworked,
              underworked,
              average: avg.toFixed(1),
              max,
              min,
            },
          });
        }
      }
    }

    // 5. העדרות ברגע האחרון - אילוצים שנוספו היום למחר
    const recentConstraints = constraints.filter(c => {
      const created = new Date(c.created_date);
      const isNewToday = isToday(created);
      const isForTomorrow = c.date === tomorrow;
      return isNewToday && isForTomorrow && c.unavailable;
    });

    if (recentConstraints.length > 0) {
      alerts.push({
        id: 'last-minute-absence',
        type: 'critical',
        severity: 'critical',
        icon: <AlertTriangle className="w-5 h-5" />,
        title: `${recentConstraints.length} העדרויות ברגע האחרון`,
        message: 'עובדים שסימנו עצמם כלא זמינים למחר - בדוק השפעה על המשמרות',
        timestamp: now,
        actionable: true,
        details: {
          constraints: recentConstraints.map(c => {
            const emp = employees.find(e => e.id === c.employee_id);
            return {
              employee: emp?.full_name,
              date: c.date,
              notes: c.notes,
            };
          }),
        },
      });
    }

    // מיון לפי חומרה
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  if (!isManager) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAlertsOpen(true)}
        className="relative"
      >
        <Bell className="w-4 h-4 ml-2" />
        התראות מערכת
        {(criticalCount + warningCount) > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {criticalCount + warningCount}
          </span>
        )}
      </Button>

      <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              התראות מערכת בזמן אמת
              <Badge variant="secondary" className="mr-2">
                {alerts.length} התראות
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">הכל תקין! אין התראות כרגע</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <AlertCard
                  key={alert.id || idx}
                  alert={alert}
                  onAction={(alert) => setSelectedAlert(alert)}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedAlert && (
        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>טיפול בהתראה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <div className="font-bold mb-2">{selectedAlert.title}</div>
                <div className="text-sm text-gray-700">{selectedAlert.message}</div>
              </div>

              <div>
                <Label>הערות (אופציונלי)</Label>
                <Textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="הערות לגבי הטיפול בהתראה..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAlert(null)}
                >
                  ביטול
                </Button>
                <Button
                  onClick={() => {
                    acknowledgeAlertMutation.mutate({
                      alertId: selectedAlert.id,
                      action: 'acknowledged',
                      notes: actionNotes,
                    });
                  }}
                >
                  סמן כטופל
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function AlertCard({ alert, onAction }) {
  const severityConfig = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-900',
      badge: 'destructive',
      badgeText: 'קריטי',
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-500',
      text: 'text-orange-900',
      badge: 'secondary',
      badgeText: 'אזהרה',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-900',
      badge: 'outline',
      badgeText: 'מידע',
    },
  };

  const config = severityConfig[alert.severity] || severityConfig.info;

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={config.text}>{alert.icon}</div>
          <div>
            <div className="font-bold text-lg mb-1">{alert.title}</div>
            <Badge variant={config.badge}>{config.badgeText}</Badge>
          </div>
        </div>
        {alert.actionable && (
          <Button
            size="sm"
            onClick={() => onAction(alert)}
          >
            טפל
          </Button>
        )}
      </div>

      <p className="text-sm mb-3">{alert.message}</p>

      {alert.details && (
        <div className="bg-white bg-opacity-60 rounded p-3 text-sm space-y-2">
          {alert.details.shifts && (
            <div>
              <strong>משמרות מושפעות:</strong>
              <div className="mt-1 space-y-1">
                {alert.details.shifts.slice(0, 5).map((shift, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(shift.date + 'T00:00:00'), 'dd/MM/yyyy')}
                    </Badge>
                    <span className="text-xs">{shift.type}</span>
                    {shift.isToday && <Badge variant="destructive" className="text-xs">היום!</Badge>}
                  </div>
                ))}
                {alert.details.shifts.length > 5 && (
                  <div className="text-xs text-gray-600">
                    + עוד {alert.details.shifts.length - 5} משמרות
                  </div>
                )}
              </div>
            </div>
          )}

          {alert.details.requests && (
            <div>
              <strong>בקשות דחופות:</strong>
              <div className="mt-1 space-y-1">
                {alert.details.requests.map((req, i) => (
                  <div key={i} className="text-xs">
                    <strong>{req.employee}</strong> - {req.type}
                    <div className="text-gray-600">
                      {format(new Date(req.startDate + 'T00:00:00'), 'dd/MM')} - {format(new Date(req.endDate + 'T00:00:00'), 'dd/MM')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alert.details.constraints && (
            <div>
              <strong>העדרויות:</strong>
              <div className="mt-1 space-y-1">
                {alert.details.constraints.map((c, i) => (
                  <div key={i} className="text-xs">
                    <strong>{c.employee}</strong> - {format(new Date(c.date + 'T00:00:00'), 'dd/MM/yyyy')}
                    {c.notes && <div className="text-gray-600">{c.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {alert.details.overworked && (
            <div>
              <strong>עומס יתר:</strong> {alert.details.overworked.join(', ')}
              {alert.details.underworked && alert.details.underworked.length > 0 && (
                <div className="mt-1">
                  <strong>עומס נמוך:</strong> {alert.details.underworked.join(', ')}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-600">
                ממוצע: {alert.details.average} משמרות | טווח: {alert.details.min}-{alert.details.max}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        {format(alert.timestamp, 'dd/MM/yyyy HH:mm')}
      </div>
    </div>
  );
}