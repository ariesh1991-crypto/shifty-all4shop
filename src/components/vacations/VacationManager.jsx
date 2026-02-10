import React, { useState } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function VacationManager({ 
  vacationRequests, 
  employees, 
  onApprove, 
  onReject 
}) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const pendingRequests = vacationRequests.filter(req => req.status === 'ממתין לאישור');

  const getDaysCount = (request) => {
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const days = eachDayOfInterval({ start, end });
    return days.length;
  };

  return (
    <div className="space-y-4">
      {pendingRequests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">אין בקשות חופשה ממתינות</p>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700">
              <strong>שים לב:</strong> כאשר תאשר בקשה, התאריכים ישמרו אוטומטית כ"לא זמין" עבור העובד במערכת האילוצים.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">עובד</TableHead>
                <TableHead className="text-right">תאריכים</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests.map((req) => {
                const employee = employees.find(e => e.id === req.employee_id);
                const daysCount = getDaysCount(req);
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{employee?.full_name}</TableCell>
                    <TableCell>
                      <div>
                        <div>{format(new Date(req.start_date), 'dd/MM/yyyy')} - {format(new Date(req.end_date), 'dd/MM/yyyy')}</div>
                        <div className="text-xs text-gray-500">{daysCount} ימים</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{req.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm">{req.notes || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => onApprove(req)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                          אשר
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSelectedRequest(req)}
                        >
                          <XCircle className="w-4 h-4 ml-1" />
                          דחה
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}

      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>דחיית בקשת חופשה</DialogTitle>
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