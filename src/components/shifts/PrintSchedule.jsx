import React from 'react';
import { format, getDay, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';

export default function PrintSchedule({ year, month, shifts, employees }) {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="print-only" style={{ display: 'none' }}>
      <style>{`
        @media print {
          .print-only {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            font-family: Arial, sans-serif;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          .print-table th, .print-table td {
            border: 1px solid #333;
            padding: 4px;
            text-align: center;
          }
          .print-table th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .print-header h1 {
            font-size: 24px;
            margin-bottom: 5px;
          }
          .print-header h2 {
            font-size: 18px;
            color: #666;
          }
        }
      `}</style>
      
      <div className="print-header">
        <h1>לוח משמרות</h1>
        <h2>{format(new Date(year, month - 1), 'MMMM yyyy', { locale: { code: 'he' } })}</h2>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>יום</th>
            <th>משמרת 1</th>
            <th>עובד 1</th>
            <th>שעות 1</th>
            <th>משמרת 2</th>
            <th>עובד 2</th>
            <th>שעות 2</th>
          </tr>
        </thead>
        <tbody>
          {days.filter(day => getDay(day) !== 6).map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayShifts = shifts.filter(s => s.date === dateStr);
            const dayOfWeek = getDay(day);
            const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
            
            return (
              <tr key={dateStr}>
                <td>{format(day, 'dd/MM')}</td>
                <td>{dayNames[dayOfWeek]}</td>
                {dayShifts[0] ? (
                  <>
                    <td>{dayShifts[0].shift_type}</td>
                    <td>{employees.find(e => e.id === dayShifts[0].assigned_employee_id)?.full_name || 'לא משובץ'}</td>
                    <td>{dayShifts[0].start_time && dayShifts[0].end_time ? `${dayShifts[0].start_time}-${dayShifts[0].end_time}` : ''}</td>
                  </>
                ) : (
                  <>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </>
                )}
                {dayShifts[1] ? (
                  <>
                    <td>{dayShifts[1].shift_type}</td>
                    <td>{employees.find(e => e.id === dayShifts[1].assigned_employee_id)?.full_name || 'לא משובץ'}</td>
                    <td>{dayShifts[1].start_time && dayShifts[1].end_time ? `${dayShifts[1].start_time}-${dayShifts[1].end_time}` : ''}</td>
                  </>
                ) : (
                  <>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: '20px', fontSize: '10px' }}>
        <p><strong>סה"כ משמרות:</strong> {shifts.filter(s => s.assigned_employee_id).length}</p>
        <p><strong>משמרות לא משובצות:</strong> {shifts.filter(s => !s.assigned_employee_id).length}</p>
      </div>
    </div>
  );
}