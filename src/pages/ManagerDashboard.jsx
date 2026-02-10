import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles, Users, LogOut, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import MonthCalendar from '../components/shifts/MonthCalendar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const SHIFT_COLORS = {
  'קצרה': 'bg-blue-200',
  'ארוכה': 'bg-purple-200',
  'שישי קצר': 'bg-yellow-200',
  'שישי ארוך': 'bg-orange-200',
};

const STATUS_COLORS = {
  'תקין': 'border-green-500',
  'בעיה': 'border-red-500',
  'חריגה מאושרת': 'border-amber-500',
};

// פונקציה לחישוב שעות
function calculateShiftTimes(shiftType, contractType) {
  if (shiftType === 'שישי קצר') return { start: '08:30', end: '12:00' };
  if (shiftType === 'שישי ארוך') return { start: '08:00', end: '14:00' };
  
  if (shiftType === 'קצרה') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '08:00', end: '17:00' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '08:00', end: '16:30' };
  }
  
  if (shiftType === 'ארוכה') {
    if (contractType === '08:00–17:00 / 10:00–19:00') return { start: '10:00', end: '19:00' };
    if (contractType === '08:00–16:30 / 10:30–19:00') return { start: '10:30', end: '19:00' };
  }
  
  return { start: '', end: '' };
}

export default function ManagerDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', year, month],
    queryFn: async () => {
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => s.date && s.date.startsWith(monthKey));
    },
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', year, month],
    queryFn: async () => {
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.date && c.date.startsWith(monthKey));
    },
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['swapRequests'],
    queryFn: () => base44.entities.SwapRequest.list(),
  });

  const pendingSwaps = swapRequests.filter(req => req.status === 'ממתין לאישור');

  const deleteShiftMutation = useMutation({
    mutationFn: (id) => base44.entities.Shift.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Shift.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['shifts']);
      toast({ title: 'המשמרת עודכנה' });
    },
  });

  const updateSwapMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SwapRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['swapRequests']);
      toast({ title: 'בקשת החלפה עודכנה' });
    },
  });

  const handleApproveSwap = async (swapRequest) => {
    const shift = shifts.find(s => s.id === swapRequest.shift_id);
    if (!shift) return;

    await updateShiftMutation.mutateAsync({
      id: shift.id,
      data: { ...shift, assigned_employee_id: swapRequest.target_employee_id }
    });

    await updateSwapMutation.mutateAsync({
      id: swapRequest.id,
      data: { status: 'אושר' }
    });
  };

  const handleRejectSwap = async (swapRequest, managerNotes) => {
    await updateSwapMutation.mutateAsync({
      id: swapRequest.id,
      data: { status: 'נדחה', manager_notes: managerNotes }
    });
  };

  const generateSchedule = async () => {
    setGenerating(true);
    try {
      for (const shift of shifts) {
        await deleteShiftMutation.mutateAsync(shift.id);
      }

      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const newShifts = [];
      const activeEmployees = employees.filter(e => e.active);
      const employeeWeeklyShifts = {};
      const employeeMonthlyFridays = {};
      const employeeLastThursdayLong = {};
      const employeeLastFriday = {};

      for (const day of days) {
        const dayOfWeek = getDay(day);
        if (dayOfWeek === 6) continue;

        const dateStr = format(day, 'yyyy-MM-dd');
        const isFriday = dayOfWeek === 5;
        const isThursday = dayOfWeek === 4;

        if (isFriday) {
          // שישי - 2 עובדים
          const availableForFriday = activeEmployees.filter(emp => {
            const constraint = constraints.find(c => c.employee_id === emp.id && c.date === dateStr);
            if (constraint?.unavailable) return false;
            
            const monthlyFridays = employeeMonthlyFridays[emp.id] || 0;
            if (monthlyFridays >= 1) return false;
            
            const lastFriday = employeeLastFriday[emp.id];
            if (lastFriday) {
              const daysDiff = Math.floor((parseISO(dateStr) - parseISO(lastFriday)) / (1000 * 60 * 60 * 24));
              if (daysDiff === 7) return false;
            }
            
            const yesterdayLong = employeeLastThursdayLong[emp.id];
            if (yesterdayLong === format(new Date(day.getTime() - 86400000), 'yyyy-MM-dd')) return false;
            
            return true;
          });

          if (availableForFriday.length >= 2) {
            const shortEmp = availableForFriday[0];
            const longEmp = availableForFriday[1];

            const shortTimes = calculateShiftTimes('שישי קצר', shortEmp.contract_type);
            const longTimes = calculateShiftTimes('שישי ארוך', longEmp.contract_type);

            newShifts.push({
              date: dateStr,
              shift_type: 'שישי קצר',
              assigned_employee_id: shortEmp.id,
              start_time: shortTimes.start,
              end_time: shortTimes.end,
              status: 'תקין',
            });

            newShifts.push({
              date: dateStr,
              shift_type: 'שישי ארוך',
              assigned_employee_id: longEmp.id,
              start_time: longTimes.start,
              end_time: longTimes.end,
              status: 'תקין',
            });

            employeeMonthlyFridays[shortEmp.id] = (employeeMonthlyFridays[shortEmp.id] || 0) + 1;
            employeeMonthlyFridays[longEmp.id] = (employeeMonthlyFridays[longEmp.id] || 0) + 1;
            employeeLastFriday[shortEmp.id] = dateStr;
            employeeLastFriday[longEmp.id] = dateStr;
          } else {
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי קצר',
              status: 'בעיה',
            });
            newShifts.push({
              date: dateStr,
              shift_type: 'שישי ארוך',
              status: 'בעיה',
            });
          }
        } else {
          // יום רגיל - קצרה וארוכה
          const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 0 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');

          const getAvailableEmployees = (preferredType) => {
            return activeEmployees.filter(emp => {
              const constraint = constraints.find(c => c.employee_id === emp.id && c.date === dateStr);
              if (constraint?.unavailable) return false;
              
              const weekShifts = employeeWeeklyShifts[emp.id]?.[weekKey] || 0;
              if (weekShifts >= 2) return false;
              
              if (constraint?.preference === `מעדיף ${preferredType}`) return true;
              if (constraint?.preference && constraint.preference !== 'אין העדפה') return false;
              
              return true;
            });
          };

          const shortAvailable = getAvailableEmployees('קצרה');
          const longAvailable = getAvailableEmployees('ארוכה');

          if (shortAvailable.length > 0) {
            const emp = shortAvailable[0];
            const times = calculateShiftTimes('קצרה', emp.contract_type);
            newShifts.push({
              date: dateStr,
              shift_type: 'קצרה',
              assigned_employee_id: emp.id,
              start_time: times.start,
              end_time: times.end,
              status: 'תקין',
            });
            if (!employeeWeeklyShifts[emp.id]) employeeWeeklyShifts[emp.id] = {};
            employeeWeeklyShifts[emp.id][weekKey] = (employeeWeeklyShifts[emp.id][weekKey] || 0) + 1;
          } else {
            newShifts.push({ date: dateStr, shift_type: 'קצרה', status: 'בעיה' });
          }

          if (longAvailable.length > 0) {
            const emp = longAvailable[0];
            const times = calculateShiftTimes('ארוכה', emp.contract_type);
            newShifts.push({
              date: dateStr,
              shift_type: 'ארוכה',
              assigned_employee_id: emp.id,
              start_time: times.start,
              end_time: times.end,
              status: 'תקין',
            });
            if (!employeeWeeklyShifts[emp.id]) employeeWeeklyShifts[emp.id] = {};
            employeeWeeklyShifts[emp.id][weekKey] = (employeeWeeklyShifts[emp.id][weekKey] || 0) + 1;
            
            if (isThursday) {
              employeeLastThursdayLong[emp.id] = dateStr;
            }
          } else {
            newShifts.push({ date: dateStr, shift_type: 'ארוכה', status: 'בעיה' });
          }
        }
      }

      await base44.entities.Shift.bulkCreate(newShifts);
      queryClient.invalidateQueries(['shifts']);
      
      toast({ title: `נוצרו ${newShifts.length} משמרות` });
    } catch (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const dayNumber = format(date, 'd');
    const isFriday = dayOfWeek === 5;

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-2 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[100px] ${isFriday ? 'bg-blue-50' : 'bg-white'}`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {dayShifts.map((shift) => {
            const employee = employees.find(e => e.id === shift.assigned_employee_id);
            return (
              <div
                key={shift.id}
                className={`text-xs p-1 rounded border-2 ${SHIFT_COLORS[shift.shift_type]} ${STATUS_COLORS[shift.status]}`}
              >
                <div className="font-medium">{employee?.full_name || 'לא משובץ'}</div>
                <div>{shift.shift_type}</div>
                {shift.start_time && shift.end_time && (
                  <div className="text-[10px] text-gray-600">{shift.start_time}–{shift.end_time}</div>
                )}
                {shift.status === 'בעיה' && (
                  <div className="text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px]">אין עובד זמין</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">לוח משמרות</h1>
          
          <div className="flex gap-3">
            <Link to={createPageUrl('ManageEmployees')}>
              <Button variant="outline">
                <Users className="w-4 h-4 ml-2" />
                ניהול עובדים
              </Button>
            </Link>
            <Button onClick={() => setSwapDialogOpen(true)} variant="outline">
              <ArrowLeftRight className="w-4 h-4 ml-2" />
              בקשות החלפה {pendingSwaps.length > 0 && `(${pendingSwaps.length})`}
            </Button>
            <Button onClick={generateSchedule} disabled={generating}>
              <Sparkles className="w-4 h-4 ml-2" />
              {generating ? 'יוצר...' : 'צור סקיצת משמרות'}
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month - 2))} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month))} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <MonthCalendar year={year} month={month} renderDay={renderDay} />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת משמרות - {selectedDate}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {shifts.filter(s => s.date === selectedDate).map(shift => (
                <div key={shift.id} className="border p-3 rounded">
                  <div className="font-bold">{shift.shift_type}</div>
                  {shift.assigned_employee_id && (
                    <>
                      <div>עובד: {employees.find(e => e.id === shift.assigned_employee_id)?.full_name}</div>
                      {shift.start_time && shift.end_time && (
                        <div className="text-sm text-gray-600">{shift.start_time}–{shift.end_time}</div>
                      )}
                    </>
                  )}
                  <div className="mt-2 text-sm">סטטוס: {shift.status}</div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="mt-2"
                    onClick={async () => {
                      await deleteShiftMutation.mutateAsync(shift.id);
                      setDialogOpen(false);
                    }}
                  >
                    מחק
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
          <DialogContent dir="rtl" className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול בקשות החלפת משמרות</DialogTitle>
            </DialogHeader>
            <SwapRequestsManager
              swapRequests={swapRequests}
              shifts={shifts}
              employees={employees}
              onApprove={handleApproveSwap}
              onReject={handleRejectSwap}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SwapRequestsManager({ swapRequests, shifts, employees, onApprove, onReject }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const pendingRequests = swapRequests.filter(req => req.status === 'ממתין לאישור');

  return (
    <div className="space-y-4">
      {pendingRequests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">אין בקשות החלפה ממתינות</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">משמרת</TableHead>
              <TableHead className="text-right">עובד מבקש</TableHead>
              <TableHead className="text-right">עובד מוצע</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingRequests.map((req) => {
              const shift = shifts.find(s => s.id === req.shift_id);
              const requestingEmp = employees.find(e => e.id === req.requesting_employee_id);
              const targetEmp = employees.find(e => e.id === req.target_employee_id);
              return (
                <TableRow key={req.id}>
                  <TableCell>
                    {shift ? (
                      <div>
                        <div className="font-medium">{format(new Date(shift.date), 'dd/MM/yyyy')}</div>
                        <div className="text-sm text-gray-600">{shift.shift_type}</div>
                        <div className="text-xs text-gray-500">{shift.start_time} - {shift.end_time}</div>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{requestingEmp?.full_name}</TableCell>
                  <TableCell>{targetEmp?.full_name}</TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm">{req.notes || '-'}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => onApprove(req)}
                      >
                        אשר
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setSelectedRequest(req)}
                      >
                        דחה
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>דחיית בקשת החלפה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>סיבת הדחייה (אופציונלי)</Label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="הסבר קצר לסיבת הדחייה..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  ביטול
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onReject(selectedRequest, rejectNotes);
                    setSelectedRequest(null);
                    setRejectNotes('');
                  }}
                >
                  דחה בקשה
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}