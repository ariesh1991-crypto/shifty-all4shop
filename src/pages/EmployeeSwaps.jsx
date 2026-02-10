import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeftRight, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function EmployeeSwaps() {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.user_id === user.id);
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list(),
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['swapRequests', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.SwapRequest.list();
      return all.filter(req => 
        req.requesting_employee_id === currentEmployee.id || 
        req.target_employee_id === currentEmployee.id
      );
    },
    enabled: !!currentEmployee,
  });

  const createSwapMutation = useMutation({
    mutationFn: (data) => base44.entities.SwapRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['swapRequests']);
      toast({ title: 'בקשת החלפה נשלחה' });
      setDialogOpen(false);
    },
  });

  const myShifts = shifts.filter(s => s.assigned_employee_id === currentEmployee?.id);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">טוען...</div>;
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">חשבונך ממתין לחיבור</h2>
          <p className="text-gray-600 mb-6">מנהל המערכת יחבר את חשבונך לרשומת העובד שלך בקרוב</p>
          <Button onClick={() => base44.auth.logout()}>
            <LogOut className="w-4 h-4 ml-2" />
            יציאה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">החלפת משמרות</h1>
          <div className="flex gap-3">
            <Link to={createPageUrl('EmployeeConstraints')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                אילוצים והעדפות
              </Button>
            </Link>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">המשמרות שלי</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">סוג משמרת</TableHead>
                  <TableHead className="text-right">שעות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myShifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{format(new Date(shift.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{shift.shift_type}</TableCell>
                    <TableCell>{shift.start_time} - {shift.end_time}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => { setSelectedShift(shift); setDialogOpen(true); }}
                      >
                        <ArrowLeftRight className="w-4 h-4 ml-2" />
                        בקש החלפה
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {myShifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      אין משמרות משובצות
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">בקשות החלפה</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">משמרת</TableHead>
                  <TableHead className="text-right">עובד מבקש</TableHead>
                  <TableHead className="text-right">עובד מוצע</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {swapRequests.map((req) => {
                  const shift = shifts.find(s => s.id === req.shift_id);
                  const requestingEmp = employees.find(e => e.id === req.requesting_employee_id);
                  const targetEmp = employees.find(e => e.id === req.target_employee_id);
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        {shift ? `${format(new Date(shift.date), 'dd/MM/yyyy')} - ${shift.shift_type}` : '-'}
                      </TableCell>
                      <TableCell>{requestingEmp?.full_name}</TableCell>
                      <TableCell>{targetEmp?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          req.status === 'אושר' ? 'default' :
                          req.status === 'נדחה' ? 'destructive' :
                          'secondary'
                        }>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{req.notes || '-'}</TableCell>
                    </TableRow>
                  );
                })}
                {swapRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      אין בקשות החלפה
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>בקשת החלפת משמרת</DialogTitle>
            </DialogHeader>
            <SwapRequestForm
              shift={selectedShift}
              currentEmployeeId={currentEmployee.id}
              employees={employees.filter(e => e.id !== currentEmployee.id && e.active)}
              onSave={(data) => createSwapMutation.mutate(data)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function SwapRequestForm({ shift, currentEmployeeId, employees, onSave }) {
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetEmployeeId) return;
    onSave({
      requesting_employee_id: currentEmployeeId,
      target_employee_id: targetEmployeeId,
      shift_id: shift.id,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-3 rounded">
        <p className="text-sm text-gray-600">משמרת: {shift?.shift_type}</p>
        <p className="text-sm text-gray-600">תאריך: {shift ? format(new Date(shift.date), 'dd/MM/yyyy') : ''}</p>
        <p className="text-sm text-gray-600">שעות: {shift?.start_time} - {shift?.end_time}</p>
      </div>

      <div>
        <Label>בחר עובד להחלפה</Label>
        <Select value={targetEmployeeId} onValueChange={setTargetEmployeeId} required>
          <SelectTrigger>
            <SelectValue placeholder="בחר עובד..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>סיבה לבקשה</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הסבר קצר לסיבת הבקשה..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="submit">שלח בקשה</Button>
      </div>
    </form>
  );
}