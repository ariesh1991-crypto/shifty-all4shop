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
import { Pencil, Trash2, ArrowRight, UserPlus, Search, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function ManageEmployees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [formData, setFormData] = useState({
    full_name: '',
    active: true,
    contract_type: '08:00–17:00 / 10:00–19:00',
    notes: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
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

  const linkUserMutation = useMutation({
    mutationFn: ({ employeeId, userId }) => base44.entities.Employee.update(employeeId, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'משתמש חובר לעובד בהצלחה' });
      setLinkDialogOpen(false);
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      active: true,
      contract_type: '08:00–17:00 / 10:00–19:00',
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
      notes: employee.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && employee.active) || 
      (filterActive === 'inactive' && !employee.active);
    return matchesSearch && matchesActive;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">ניהול עובדים</h1>
          <Link to={createPageUrl('ManagerDashboard')}>
            <Button variant="outline">
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה ללוח משמרות
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="חיפוש עובד לפי שם..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="active">פעילים</SelectItem>
                <SelectItem value="inactive">לא פעילים</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם עובד</TableHead>
                <TableHead className="text-right">פעיל</TableHead>
                <TableHead className="text-right">משתמש מחובר</TableHead>
                <TableHead className="text-right">סוג חוזה שעות</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const linkedUser = users.find(u => u.id === employee.user_id);
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.full_name}</TableCell>
                    <TableCell>{employee.active ? '✓' : '✗'}</TableCell>
                    <TableCell>
                      {linkedUser ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{linkedUser.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">לא מחובר</span>
                      )}
                    </TableCell>
                    <TableCell>{employee.contract_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{employee.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedEmployee(employee); setLinkDialogOpen(true); }}
                          title="חבר משתמש"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(employee)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(employee.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>חיבור משתמש לעובד: {selectedEmployee?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">בחר משתמש שנרשם למערכת כדי לחבר אותו לרשומת העובד</p>
              <div className="space-y-2">
                {users.filter(u => !employees.some(e => e.user_id === u.id)).map(user => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => linkUserMutation.mutate({ employeeId: selectedEmployee.id, userId: user.id })}
                  >
                    <div className="text-right">
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </Button>
                ))}
                {users.filter(u => !employees.some(e => e.user_id === u.id)).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">אין משתמשים זמינים לחיבור</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}