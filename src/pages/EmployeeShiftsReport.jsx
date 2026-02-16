import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Download, TrendingUp, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui/use-toast';

export default function EmployeeShiftsReport() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['allShifts'],
    queryFn: () => base44.entities.Shift.list(),
  });

  // חישוב חודשים זמינים (6 חודשים אחרונים + 6 קדימה)
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 6, 1);
  const availableMonths = eachMonthOfInterval({ start: startDate, end: endDate });

  // סינון משמרות לחודש הנבחר
  const monthShifts = allShifts.filter(s => s.date && s.date.startsWith(selectedMonth));

  // חישוב סטטיסטיקות לכל עובד
  const employeeStats = employees
    .filter(e => e.active)
    .map(emp => {
      const empShifts = monthShifts.filter(s => s.assigned_employee_id === emp.id);
      const fridayShifts = empShifts.filter(s => s.shift_type?.includes('שישי'));
      const earlyShifts = empShifts.filter(s => s.shift_type === 'מסיים ב-17:30');
      const lateShifts = empShifts.filter(s => s.shift_type === 'מסיים ב-19:00');

      return {
        employee: emp,
        totalShifts: empShifts.length,
        fridayShifts: fridayShifts.length,
        earlyShifts: earlyShifts.length,
        lateShifts: lateShifts.length,
        shifts: empShifts,
      };
    })
    .sort((a, b) => b.totalShifts - a.totalShifts);

  const exportToExcel = () => {
    const data = employeeStats.map(stat => ({
      'עובד': stat.employee.full_name,
      'סה"כ משמרות': stat.totalShifts,
      'משמרות שישי': stat.fridayShifts,
      'מסיים 17:30': stat.earlyShifts,
      'מסיים 19:00': stat.lateShifts,
      'סוג חוזה': stat.employee.contract_type,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח עובדים');
    XLSX.writeFile(wb, `דוח_עובדים_${selectedMonth}.xlsx`);
    toast({ title: 'הקובץ יוצא בהצלחה' });
  };

  const totalShifts = employeeStats.reduce((sum, s) => sum + s.totalShifts, 0);
  const avgShiftsPerEmployee = employeeStats.length > 0 ? (totalShifts / employeeStats.length).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">דוח משמרות לפי עובד</h1>
          <div className="flex gap-2">
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">סה״כ משמרות</CardTitle>
              <Calendar className="w-5 h-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalShifts}</div>
              <p className="text-xs text-gray-500 mt-1">בחודש {selectedMonth}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ממוצע לעובד</CardTitle>
              <TrendingUp className="w-5 h-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgShiftsPerEmployee}</div>
              <p className="text-xs text-gray-500 mt-1">משמרות לעובד</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">עובדים פעילים</CardTitle>
              <TrendingUp className="w-5 h-5 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{employeeStats.length}</div>
              <p className="text-xs text-gray-500 mt-1">עם משמרות</p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => {
                    const monthKey = format(month, 'yyyy-MM');
                    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
                    const monthName = monthNames[month.getMonth()];
                    const year = month.getFullYear();
                    return (
                      <SelectItem key={monthKey} value={monthKey}>
                        {monthName} {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={exportToExcel} variant="outline">
              <Download className="w-4 h-4 ml-2" />
              ייצא לאקסל
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">עובד</TableHead>
                <TableHead className="text-right">סה״כ משמרות</TableHead>
                <TableHead className="text-right">משמרות שישי</TableHead>
                <TableHead className="text-right">מסיים 17:30</TableHead>
                <TableHead className="text-right">מסיים 19:00</TableHead>
                <TableHead className="text-right">סוג חוזה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeeStats.map((stat) => (
                <TableRow key={stat.employee.id}>
                  <TableCell className="font-medium">{stat.employee.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {stat.totalShifts}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{stat.fridayShifts}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{stat.earlyShifts}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{stat.lateShifts}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {stat.employee.contract_type}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}