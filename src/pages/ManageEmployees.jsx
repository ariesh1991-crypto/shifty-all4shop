import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { ArrowRight } from 'lucide-react';

const CONTRACT_TYPES = {
  type1: 'חוזה סוג 1 (08:00-16:30 או 10:30-19:00)',
  type2: 'חוזה סוג 2 (08:00-17:00 או 10:00-19:00)',
};

export default function ManageEmployees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    contract_type: 'type1',
  });
  const [approveFormData, setApproveFormData] = useState({
    full_name: '',
    contract_type: 'type1',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // בדיקת הרשאות מנהל
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await base44.auth.me();
        if (user.role !== 'admin') {
          toast({
            title: 'אין הרשאה',
            description: 'רק מנהלים יכולים לגשת לדף זה',
            variant: 'destructive',
          });
          window.location.href = createPageUrl('EmployeeConstraints');
          return;
        }
        setIsAdmin(true);
      } catch (error) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן לאמת הרשאות',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [toast]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date'),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: isAdmin,
  });

  // משתמשים שעדיין לא עובדים
  const pendingUsers = allUsers.filter(user => 
    !employees.some(emp => emp.email.toLowerCase() === user.email.toLowerCase())
  );

  const createEmployeeMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'העובד נוסף בהצלחה' });
      resetForm();
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'העובד עודכן בהצלחה' });
      resetForm();
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'העובד נמחק בהצלחה' });
    },
  });

  const resetForm = () => {
    setFormData({ full_name: '', email: '', contract_type: 'type1' });
    setEditingEmployee(null);
    setDialogOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingEmployee) {
      await updateEmployeeMutation.mutateAsync({
        id: editingEmployee.id,
        data: formData,
      });
    } else {
      await createEmployeeMutation.mutateAsync(formData);
      // הזמנת המשתמש למערכת
      try {
        await base44.users.inviteUser(formData.email, 'user');
        toast({ title: 'העובד נוסף והוזמן למערכת בהצלחה' });
      } catch (error) {
        toast({ 
          title: 'העובד נוסף אבל לא ניתן היה להזמין למערכת', 
          description: error.message,
          variant: 'destructive' 
        });
      }
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      contract_type: employee.contract_type,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
      await deleteEmployeeMutation.mutateAsync(id);
    }
  };

  const handleApproveUser = (user) => {
    setSelectedUser(user);
    setApproveFormData({
      full_name: user.full_name || '',
      contract_type: 'type1',
    });
    setApproveDialogOpen(true);
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    await createEmployeeMutation.mutateAsync({
      full_name: approveFormData.full_name,
      email: selectedUser.email,
      contract_type: approveFormData.contract_type,
    });

    setApproveDialogOpen(false);
    setSelectedUser(null);
    queryClient.invalidateQueries(['all-users']);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-lg text-gray-700">טוען...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="ghost" size="icon">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">ניהול עובדים</h1>
          </div>
          
          <Button onClick={() => setDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 ml-2" />
            הוסף עובד
          </Button>
        </div>

        {pendingUsers.length > 0 && (
          <div className="bg-amber-50 rounded-lg shadow-md overflow-hidden mb-6 border-2 border-amber-200">
            <div className="bg-amber-100 px-6 py-3 border-b border-amber-200">
              <h2 className="text-lg font-bold text-amber-900">משתמשים ממתינים לאישור ({pendingUsers.length})</h2>
              <p className="text-sm text-amber-700">משתמשים שנרשמו למערכת אבל עדיין לא אושרו כעובדים</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">תאריך הרשמה</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || 'לא הוזן'}</TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(user.created_date).toLocaleDateString('he-IL')}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleApproveUser(user)}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <UserPlus className="w-4 h-4 ml-2" />
                        אשר כעובד
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b">
            <h2 className="text-lg font-bold text-gray-900">עובדים מאושרים</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם עובד</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">סוג חוזה</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    אין עובדים במערכת. הוסף עובד ראשון!
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.full_name}</TableCell>
                    <TableCell className="text-gray-600">{employee.email}</TableCell>
                    <TableCell>{CONTRACT_TYPES[employee.contract_type]}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(employee)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(employee.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'עריכת עובד' : 'הוספת עובד חדש'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">שם מלא</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="הזן שם מלא"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@all4shop.co.il"
                  required
                  disabled={!!editingEmployee}
                />
                {!editingEmployee && (
                  <p className="text-xs text-gray-500">העובד יקבל הזמנה למערכת באימייל זה</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contract_type">סוג חוזה</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="type1">חוזה סוג 1 (08:00-16:30 או 10:30-19:00)</SelectItem>
                    <SelectItem value="type2">חוזה סוג 2 (08:00-17:00 או 10:00-19:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  ביטול
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {editingEmployee ? 'עדכן' : 'הוסף'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>אישור עובד חדש</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleApproveSubmit} className="space-y-4 py-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>אימייל:</strong> {selectedUser?.email}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve_full_name">שם מלא</Label>
                <Input
                  id="approve_full_name"
                  value={approveFormData.full_name}
                  onChange={(e) => setApproveFormData({ ...approveFormData, full_name: e.target.value })}
                  placeholder="הזן שם מלא"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="approve_contract_type">סוג חוזה</Label>
                <Select
                  value={approveFormData.contract_type}
                  onValueChange={(value) => setApproveFormData({ ...approveFormData, contract_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="type1">חוזה סוג 1 (08:00-16:30 או 10:30-19:00)</SelectItem>
                    <SelectItem value="type2">חוזה סוג 2 (08:00-17:00 או 10:00-19:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  אשר עובד
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}