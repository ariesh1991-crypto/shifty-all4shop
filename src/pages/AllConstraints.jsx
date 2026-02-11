import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ArrowRight, Trash2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export default function AllConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allConstraints = [] } = useQuery({
    queryKey: ['constraints', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.date && c.date.startsWith(monthKey));
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נמחק בהצלחה' });
    },
  });

  const filteredConstraints = allConstraints
    .filter(c => {
      const employeeMatch = filterEmployee === 'all' || c.employee_id === filterEmployee;
      const typeMatch = filterType === 'all' || 
        (filterType === 'unavailable' && c.unavailable) ||
        (filterType === 'preference' && c.preference && !c.unavailable);
      return employeeMatch && typeMatch;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleDeleteAll = async () => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את כל ${allConstraints.length} האילוצים לחודש זה?`)) return;
    
    for (const constraint of allConstraints) {
      await deleteConstraintMutation.mutateAsync(constraint.id);
    }
    toast({ title: `נמחקו ${allConstraints.length} אילוצים` });
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    return emp?.full_name || 'לא ידוע';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">כל האילוצים וההעדפות</h1>
          <div className="flex gap-2 flex-wrap">
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה ללוח משמרות
              </Button>
            </Link>
            <Button onClick={() => setCurrentDate(new Date(year, month - 2))} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month))} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4 items-center justify-between flex-wrap">
            <div className="flex gap-4 items-center">
              <Filter className="w-5 h-5 text-gray-500" />
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="כל העובדים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל העובדים</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="כל הסוגים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  <SelectItem value="unavailable">לא זמין בלבד</SelectItem>
                  <SelectItem value="preference">העדפות בלבד</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {filteredConstraints.length} אילוצים
              </Badge>
              {allConstraints.length > 0 && (
                <Button 
                  onClick={handleDeleteAll} 
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  מחק הכל
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredConstraints.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl">אין אילוצים לחודש זה</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">עובד</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">העדפה</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConstraints.map((constraint) => (
                  <TableRow key={constraint.id}>
                    <TableCell className="font-medium">
                      {format(new Date(constraint.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{getEmployeeName(constraint.employee_id)}</TableCell>
                    <TableCell>
                      {constraint.unavailable ? (
                        <Badge variant="destructive">לא זמין</Badge>
                      ) : (
                        <Badge variant="secondary">זמין</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {constraint.preference ? (
                        <span className="text-sm">{constraint.preference}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {constraint.notes ? (
                        <span className="text-sm">{constraint.notes}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('האם למחוק אילוץ זה?')) {
                            deleteConstraintMutation.mutate(constraint.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}