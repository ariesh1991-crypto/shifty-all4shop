import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RecurringConstraints() {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [managerNotes, setManagerNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: recurringConstraints = [] } = useQuery({
    queryKey: ['recurringConstraints'],
    queryFn: () => base44.entities.RecurringConstraint.list('-created_date'),
  });

  const updateRecurringConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RecurringConstraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringConstraints']);
    },
  });

  const createRecurringConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringConstraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringConstraints']);
      toast({ title: 'אילוץ קבוע נוצר בהצלחה' });
      setCreateDialogOpen(false);
    },
  });

  const handleApprove = async (rc) => {
    await updateRecurringConstraintMutation.mutateAsync({
      id: rc.id,
      data: { status: 'אושר' }
    });

    // שלח התראה לעובד
    const employee = employees.find(e => e.id === rc.employee_id);
    if (employee?.user_id) {
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_approved',
        title: 'אילוץ קבוע אושר',
        message: `אילוץ קבוע שלך ליום ${dayNames[rc.day_of_week]} אושר על ידי המנהל`,
      });
    }

    toast({ title: 'אילוץ קבוע אושר' });
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    await updateRecurringConstraintMutation.mutateAsync({
      id: selectedRequest.id,
      data: { status: 'נדחה', manager_notes: managerNotes }
    });

    // שלח התראה לעובד
    const employee = employees.find(e => e.id === selectedRequest.employee_id);
    if (employee?.user_id) {
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_rejected',
        title: 'אילוץ קבוע נדחה',
        message: managerNotes || `אילוץ קבוע שלך ליום ${dayNames[selectedRequest.day_of_week]} נדחה על ידי המנהל`,
      });
    }

    toast({ title: 'אילוץ קבוע נדחה' });
    setRejectDialogOpen(false);
    setSelectedRequest(null);
    setManagerNotes('');
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    return emp?.full_name || 'לא ידוע';
  };

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

  const pendingRequests = recurringConstraints.filter(rc => rc.status === 'ממתין לאישור');
  const approvedRequests = recurringConstraints.filter(rc => rc.status === 'אושר');
  const rejectedRequests = recurringConstraints.filter(rc => rc.status === 'נדחה');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">ניהול אילוצים קבועים</h1>
          <div className="flex gap-3">
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              + צור אילוץ קבוע לעובד
            </Button>
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה ללוח משמרות
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 מה זה אילוצים קבועים?</h3>
          <p className="text-sm text-blue-700">
            אילוצים קבועים הם ימים בשבוע שבהם עובד אינו זמין באופן קבוע (למשל: לימודים בכל יום שלישי).
            בקשות אלו דורשות אישור שלך לפני שהן נכנסות לתוקף וחוסמות משמרות בסידור האוטומטי.
          </p>
        </div>

        {/* בקשות ממתינות */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              ⏳ בקשות ממתינות לאישור
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="text-lg">{pendingRequests.length}</Badge>
              )}
            </h2>
            {pendingRequests.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    if (confirm(`האם לאשר את כל ${pendingRequests.length} הבקשות?`)) {
                      for (const req of pendingRequests) {
                        await handleApprove(req);
                      }
                    }
                  }}
                  variant="default"
                  size="sm"
                >
                  אשר הכל
                </Button>
                <Button 
                  onClick={async () => {
                    const reason = prompt('הסבר (אופציונלי) לדחיית כל הבקשות:');
                    if (reason !== null) {
                      for (const req of pendingRequests) {
                        await updateRecurringConstraintMutation.mutateAsync({
                          id: req.id,
                          data: { status: 'נדחה', manager_notes: reason || 'כל הבקשות נדחו' }
                        });
                      }
                      toast({ title: `נדחו ${pendingRequests.length} בקשות` });
                    }
                  }}
                  variant="destructive"
                  size="sm"
                >
                  דחה הכל
                </Button>
              </div>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>אין בקשות ממתינות לאישור</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">עובד</TableHead>
                  <TableHead className="text-right">יום בשבוע</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((rc) => (
                  <TableRow key={rc.id}>
                    <TableCell className="font-medium">{getEmployeeName(rc.employee_id)}</TableCell>
                    <TableCell>יום {dayNames[rc.day_of_week]}</TableCell>
                    <TableCell className="max-w-xs">
                      {rc.notes ? (
                        <div className="text-sm">💬 {rc.notes}</div>
                      ) : (
                        <span className="text-gray-400">אין הערות</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(rc)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          אשר
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(rc);
                            setRejectDialogOpen(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 ml-1" />
                          דחה
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* אילוצים מאושרים */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            ✅ אילוצים מאושרים
            {approvedRequests.length > 0 && (
              <Badge variant="default" className="text-lg">{approvedRequests.length}</Badge>
            )}
          </h2>

          {approvedRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>אין אילוצים מאושרים</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">עובד</TableHead>
                  <TableHead className="text-right">יום בשבוע</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedRequests.map((rc) => (
                  <TableRow key={rc.id}>
                    <TableCell className="font-medium">{getEmployeeName(rc.employee_id)}</TableCell>
                    <TableCell>יום {dayNames[rc.day_of_week]}</TableCell>
                    <TableCell className="max-w-xs">
                      {rc.notes ? (
                        <div className="text-sm">💬 {rc.notes}</div>
                      ) : (
                        <span className="text-gray-400">אין הערות</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (confirm('האם לבטל את האישור של אילוץ זה?')) {
                            await updateRecurringConstraintMutation.mutateAsync({
                              id: rc.id,
                              data: { status: 'נדחה', manager_notes: 'אישור בוטל' }
                            });
                            toast({ title: 'אישור בוטל' });
                          }
                        }}
                      >
                        בטל אישור
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* אילוצים נדחים */}
        {rejectedRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              ❌ אילוצים נדחים
              <Badge variant="destructive" className="text-lg">{rejectedRequests.length}</Badge>
            </h2>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">עובד</TableHead>
                  <TableHead className="text-right">יום בשבוע</TableHead>
                  <TableHead className="text-right">הערות עובד</TableHead>
                  <TableHead className="text-right">הערות מנהל</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedRequests.map((rc) => (
                  <TableRow key={rc.id}>
                    <TableCell className="font-medium">{getEmployeeName(rc.employee_id)}</TableCell>
                    <TableCell>יום {dayNames[rc.day_of_week]}</TableCell>
                    <TableCell className="max-w-xs">
                      {rc.notes ? (
                        <div className="text-sm">💬 {rc.notes}</div>
                      ) : (
                        <span className="text-gray-400">אין הערות</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {rc.manager_notes ? (
                        <div className="text-sm text-gray-600">{rc.manager_notes}</div>
                      ) : (
                        <span className="text-gray-400">אין הערות</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* דיאלוג דחייה */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>דחיית בקשה לאילוץ קבוע</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedRequest && (
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="text-sm">
                    <strong>עובד:</strong> {getEmployeeName(selectedRequest.employee_id)}
                  </div>
                  <div className="text-sm">
                    <strong>יום:</strong> {dayNames[selectedRequest.day_of_week]}
                  </div>
                  {selectedRequest.notes && (
                    <div className="text-sm mt-2">
                      <strong>הערות העובד:</strong> {selectedRequest.notes}
                    </div>
                  )}
                </div>
              )}
              
              <div>
                <Label>סיבת הדחייה (אופציונלי)</Label>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="הסבר קצר לעובד מדוע הבקשה נדחתה..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setRejectDialogOpen(false);
                    setSelectedRequest(null);
                    setManagerNotes('');
                  }}
                >
                  ביטול
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                >
                  דחה בקשה
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* דיאלוג יצירת אילוץ קבוע */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>יצירת אילוץ קבוע לעובד</DialogTitle>
            </DialogHeader>
            <CreateRecurringConstraintForm
              employees={employees}
              onSave={(data) => createRecurringConstraintMutation.mutate(data)}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function CreateRecurringConstraintForm({ employees, onSave, onCancel }) {
  const [employeeId, setEmployeeId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [notes, setNotes] = useState('');

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId || dayOfWeek === '') return;
    
    onSave({
      employee_id: employeeId,
      day_of_week: parseInt(dayOfWeek),
      unavailable: true,
      notes,
      status: 'אושר', // נוצר כבר מאושר כי המנהל יוצר אותו
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 text-sm text-blue-800">
        💡 אילוץ זה ייכנס לתוקף מיידית ויחסום את העובד מסידור אוטומטי ביום זה בכל שבוע
      </div>

      <div>
        <Label>בחר עובד</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} required>
          <SelectTrigger>
            <SelectValue placeholder="בחר עובד..." />
          </SelectTrigger>
          <SelectContent>
            {employees.filter(e => e.active).map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>בחר יום בשבוע</Label>
        <Select value={dayOfWeek} onValueChange={setDayOfWeek} required>
          <SelectTrigger>
            <SelectValue placeholder="בחר יום..." />
          </SelectTrigger>
          <SelectContent>
            {dayNames.map((day, idx) => (
              <SelectItem key={idx} value={idx.toString()}>יום {day}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>הערות (אופציונלי)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="למשל: לימודים, מילואים, התחייבות משפחתית..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit" disabled={!employeeId || dayOfWeek === ''}>
          צור אילוץ קבוע
        </Button>
      </div>
    </form>
  );
}