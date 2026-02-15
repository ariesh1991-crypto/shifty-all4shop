import React, { useState } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Search, Filter, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function VacationManager({ 
  vacationRequests, 
  employees, 
  onApprove, 
  onReject 
}) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedRequests, setSelectedRequests] = useState([]);

  const pendingRequests = vacationRequests.filter(req => req.status === 'ממתין לאישור');

  const getDaysCount = (request) => {
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    const days = eachDayOfInterval({ start, end });
    return days.length;
  };

  // סינון בקשות
  const filteredRequests = pendingRequests.filter(req => {
    const employee = employees.find(e => e.id === req.employee_id);
    const matchesSearch = !searchTerm || 
      employee?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStartDate = !startDateFilter || 
      req.start_date >= startDateFilter;
    
    const matchesEndDate = !endDateFilter || 
      req.end_date <= endDateFilter;
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const toggleSelectRequest = (reqId) => {
    if (selectedRequests.includes(reqId)) {
      setSelectedRequests(selectedRequests.filter(id => id !== reqId));
    } else {
      setSelectedRequests([...selectedRequests, reqId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map(r => r.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0) return;
    
    for (const reqId of selectedRequests) {
      const req = pendingRequests.find(r => r.id === reqId);
      if (req) await onApprove(req);
    }
    
    setSelectedRequests([]);
  };

  const handleBulkReject = () => {
    if (selectedRequests.length === 0) return;
    setSelectedRequest({ isBulk: true, ids: selectedRequests });
  };

  return (
    <div className="space-y-4">
      {/* פילטרים וחיפוש */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="font-bold">סינון וחיפוש</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm mb-2">חיפוש לפי שם עובד</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="הקלד שם..."
                className="pr-10"
              />
            </div>
          </div>
          
          <div>
            <Label className="text-sm mb-2">מתאריך</Label>
            <Input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
            />
          </div>
          
          <div>
            <Label className="text-sm mb-2">עד תאריך</Label>
            <Input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
            />
          </div>
        </div>

        {(searchTerm || startDateFilter || endDateFilter) && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
          >
            נקה סינון
          </Button>
        )}
      </div>

      {/* פעולות מרובות */}
      {selectedRequests.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-blue-900">
              {selectedRequests.length} בקשות נבחרו
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleBulkApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              אשר הכל
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkReject}
            >
              דחה הכל
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedRequests([])}
            >
              בטל בחירה
            </Button>
          </div>
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          {pendingRequests.length === 0 
            ? 'אין בקשות חופשה ממתינות' 
            : 'לא נמצאו בקשות התואמות את הסינון'}
        </p>
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
                <TableHead className="text-right w-12">
                  <Checkbox
                    checked={selectedRequests.length === filteredRequests.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="text-right">עובד</TableHead>
                <TableHead className="text-right">תאריכים</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => {
                const employee = employees.find(e => e.id === req.employee_id);
                const daysCount = getDaysCount(req);
                const isSelected = selectedRequests.includes(req.id);
                
                return (
                  <TableRow key={req.id} className={isSelected ? 'bg-blue-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectRequest(req.id)}
                      />
                    </TableCell>
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
              <DialogTitle>
                {selectedRequest.isBulk 
                  ? `דחיית ${selectedRequest.ids.length} בקשות חופשה` 
                  : 'דחיית בקשת חופשה'}
              </DialogTitle>
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
                  onClick={async () => {
                    if (selectedRequest.isBulk) {
                      for (const reqId of selectedRequest.ids) {
                        const req = pendingRequests.find(r => r.id === reqId);
                        if (req) await onReject(req, rejectNotes);
                      }
                      setSelectedRequests([]);
                    } else {
                      await onReject(selectedRequest, rejectNotes);
                    }
                    setSelectedRequest(null);
                    setRejectNotes('');
                  }}
                >
                  דחה {selectedRequest.isBulk ? 'הכל' : 'בקשה'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}