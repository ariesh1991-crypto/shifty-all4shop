import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Trash2, Plus, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function ManageEmployees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    active: true,
    contract_type: '08:00–17:00 / 10:00–19:00',
    unavailable: false,
    last_friday_date: '',
    monthly_shifts_count: 0,
    monthly_fridays_count: 0,
    notes: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'עובד נוסף בהצלחה' });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'עובד עודכן בהצלחה' });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'עובד נמחק בהצלחה' });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      active: true,
      contract_type: '08:00–17:00 / 10:00–19:00',
      unavailable: false,
      last_friday_date: '',
      monthly_shifts_count: 0,
      monthly_fridays_count: 0,
      notes: '',
    });
    setEditingEmployee(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      active: employee.active,
      contract_type: employee.contract_type,
      unavailable: employee.unavailable,
      last_friday_date: employee.last_friday_date || '',
      monthly_shifts_count: employee.monthly_shifts_count || 0,
      monthly_fridays_count: employee.monthly_fridays_count || 0,
      notes: employee.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">ניהול עובדים</h1>
          <div className="flex gap-3">
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" />
              הוסף עובד
            </Button>
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה ללוח משמרות
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם עובד</TableHead>
                <TableHead className="text-right">פעיל</TableHead>
                <TableHead className="text-right">סוג חוזה שעות</TableHead>
                <TableHead className="text-right">לא זמין</TableHead>
                <TableHead className="text-right">שישי אחרון</TableHead>
                <TableHead className="text-right">משמרות חודש</TableHead>
                <TableHead className="text-right">שישיים חודש</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.full_name}</TableCell>
                  <TableCell>{employee.active ? '✓' : '✗'}</TableCell>
                  <TableCell>{employee.contract_type}</TableCell>
                  <TableCell>{employee.unavailable ? '✓ לא זמין' : '-'}</TableCell>
                  <TableCell>{employee.last_friday_date || '-'}</TableCell>
                  <TableCell>{employee.monthly_shifts_count || 0}</TableCell>
                  <TableCell>{employee.monthly_fridays_count || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(employee)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(employee.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'עריכת עובד' : 'הוספת עובד חדש'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>שם עובד</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>פעיל</Label>
              </div>

              <div>
                <Label>סוג חוזה שעות</Label>
                <Select value={formData.contract_type} onValueChange={(value) => setFormData({ ...formData, contract_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00–17:00 / 10:00–19:00">08:00–17:00 / 10:00–19:00</SelectItem>
                    <SelectItem value="08:00–16:30 / 10:30–19:00">08:00–16:30 / 10:30–19:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.unavailable}
                  onCheckedChange={(checked) => setFormData({ ...formData, unavailable: checked })}
                />
                <Label>לא זמין</Label>
              </div>

              <div>
                <Label>תאריך שישי אחרון</Label>
                <Input
                  type="date"
                  value={formData.last_friday_date}
                  onChange={(e) => setFormData({ ...formData, last_friday_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>כמות משמרות החודש</Label>
                  <Input
                    type="number"
                    value={formData.monthly_shifts_count}
                    onChange={(e) => setFormData({ ...formData, monthly_shifts_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>כמות שישיים החודש</Label>
                  <Input
                    type="number"
                    value={formData.monthly_fridays_count}
                    onChange={(e) => setFormData({ ...formData, monthly_fridays_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label>הערות</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit">
                  {editingEmployee ? 'עדכן' : 'הוסף'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}