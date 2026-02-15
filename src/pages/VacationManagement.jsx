import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Calendar, Check, X, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import * as XLSX from 'xlsx';

export default function VacationManagement() {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [managerNotes, setManagerNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['vacationRequests'],
    queryFn: () => base44.entities.VacationRequest.list('-created_date'),
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints'],
    queryFn: () => base44.entities.Constraint.list(),
  });

  const updateVacationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VacationRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacationRequests']);
    },
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
    },
  });

  const handleApprove = async (request) => {
    // עדכן סטטוס לאושר
    await updateVacationMutation.mutateAsync({
      id: request.id,
      data: { status: 'אושר' }
    });

    // צור אילוצים אוטומטית
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const dates = eachDayOfInterval({ start, end });

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = constraints.find(c => c.employee_id === request.employee_id && c.date === dateStr);
      
      if (!existing) {
        await createConstraintMutation.mutateAsync({
          employee_id: request.employee_id,
          date: dateStr,
          unavailable: true,
          notes: `${request.type} מאושרת`
        });
      }
    }

    // שלח התראה
    const employee = employees.find(e => e.id === request.employee_id);
    if (employee?.user_id) {
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_approved',
        title: 'בקשת החופשה אושרה',
        message: `בקשת ה${request.type} שלך לתאריכים ${format(start, 'dd/MM')} - ${format(end, 'dd/MM')} אושרה`,
      });
    }

    toast({ title: 'בקשת החופשה אושרה' });
  };

  const handleReject = async () => {
    await updateVacationMutation.mutateAsync({
      id: selectedRequest.id,
      data: { status: 'נדחה', manager_notes: managerNotes }
    });

    const employee = employees.find(e => e.id === selectedRequest.employee_id);
    if (employee?.user_id) {
      await base44.entities.Notification.create({
        user_id: employee.user_id,
        employee_id: employee.id,
        type: 'swap_rejected',
        title: 'בקשת החופשה נדחתה',
        message: managerNotes || 'בקשת החופשה שלך נדחתה על ידי המנהל',
      });
    }

    setRejectDialogOpen(false);
    setSelectedRequest(null);
    setManagerNotes('');
    toast({ title: 'בקשת החופשה נדחתה' });
  };

  const renderVacationRow = (request, showActions = false) => {
    const employee = employees.find(e => e.id === request.employee_id);
    const startDate = new Date(request.start_date);
    const endDate = new Date(request.end_date);
    const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    return (
      <TableRow key={request.id}>
        <TableCell>
          <div className="font-medium">{employee?.full_name || 'לא ידוע'}</div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div>
              <div className="font-medium">
                {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
              </div>
              <div className="text-xs text-gray-500">{dayCount} ימים</div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{request.type}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={
            request.status === 'אושר' ? 'default' :
            request.status === 'נדחה' ? 'destructive' :
            'secondary'
          }>
            {request.status}
          </Badge>
        </TableCell>
        <TableCell className="max-w-xs">
          {request.notes && <div className="text-sm text-gray-700 mb-1">{request.notes}</div>}
          {request.manager_notes && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <strong>הערת מנהל:</strong> {request.manager_notes}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="text-xs text-gray-500">
            {format(new Date(request.created_date), 'dd/MM/yyyy HH:mm')}
          </div>
        </TableCell>
        {showActions && (
          <TableCell>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(request)}
              >
                <Check className="w-4 h-4 ml-1" />
                אשר
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedRequest(request);
                  setRejectDialogOpen(true);
                }}
              >
                <X className="w-4 h-4 ml-1" />
                דחה
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const pendingRequests = vacationRequests.filter(r => r.status === 'ממתין לאישור');
  const approvedRequests = vacationRequests.filter(r => r.status === 'אושר');
  const rejectedRequests = vacationRequests.filter(r => r.status === 'נדחה');

  const exportToExcel = (requests, sheetName) => {
    const data = requests.map(req => {
      const employee = employees.find(e => e.id === req.employee_id);
      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        'עובד': employee?.full_name || 'לא ידוע',
        'מתאריך': format(startDate, 'dd/MM/yyyy'),
        'עד תאריך': format(endDate, 'dd/MM/yyyy'),
        'ימים': dayCount,
        'סוג': req.type,
        'סטטוס': req.status,
        'הערות עובד': req.notes || '',
        'הערות מנהל': req.manager_notes || '',
        'תאריך הגשה': format(new Date(req.created_date), 'dd/MM/yyyy HH:mm'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'הקובץ יוצא בהצלחה' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">ניהול בקשות חופשה</h1>
          <Link to={createPageUrl('ManagerDashboard')}>
            <Button variant="outline">
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה ללוח בקרה
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="relative">
              ממתינות לאישור
              {pendingRequests.length > 0 && (
                <Badge className="mr-2 bg-yellow-500">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              מאושרות ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              נדחו ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {pendingRequests.length > 0 && (
                <div className="p-4 border-b flex justify-end">
                  <Button onClick={() => exportToExcel(pendingRequests, 'בקשות_ממתינות')} variant="outline" size="sm">
                    <Download className="w-4 h-4 ml-2" />
                    ייצא לאקסל
                  </Button>
                </div>
              )}
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>אין בקשות חופשה ממתינות</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">עובד</TableHead>
                      <TableHead className="text-right">תאריכים</TableHead>
                      <TableHead className="text-right">סוג</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">הערות</TableHead>
                      <TableHead className="text-right">תאריך הגשה</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map(request => renderVacationRow(request, true))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {approvedRequests.length > 0 && (
                <div className="p-4 border-b flex justify-end">
                  <Button onClick={() => exportToExcel(approvedRequests, 'חופשות_מאושרות')} variant="outline" size="sm">
                    <Download className="w-4 h-4 ml-2" />
                    ייצא לאקסל
                  </Button>
                </div>
              )}
              {approvedRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Check className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>אין בקשות חופשה מאושרות</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">עובד</TableHead>
                      <TableHead className="text-right">תאריכים</TableHead>
                      <TableHead className="text-right">סוג</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">הערות</TableHead>
                      <TableHead className="text-right">תאריך הגשה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedRequests.map(request => renderVacationRow(request, false))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rejected">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {rejectedRequests.length > 0 && (
                <div className="p-4 border-b flex justify-end">
                  <Button onClick={() => exportToExcel(rejectedRequests, 'בקשות_נדחות')} variant="outline" size="sm">
                    <Download className="w-4 h-4 ml-2" />
                    ייצא לאקסל
                  </Button>
                </div>
              )}
              {rejectedRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <X className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>אין בקשות חופשה נדחות</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">עובד</TableHead>
                      <TableHead className="text-right">תאריכים</TableHead>
                      <TableHead className="text-right">סוג</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">הערות</TableHead>
                      <TableHead className="text-right">תאריך הגשה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedRequests.map(request => renderVacationRow(request, false))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>דחיית בקשת חופשה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>סיבת הדחייה</Label>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="הסבר לעובד מדוע הבקשה נדחתה..."
                  rows={4}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                  ביטול
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  דחה בקשה
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}