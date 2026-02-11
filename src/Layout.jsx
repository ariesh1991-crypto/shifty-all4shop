import React from 'react';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <style>
        {`
          input[type="date"] {
            direction: ltr !important;
            text-align: right;
          }
          input[type="date"]::-webkit-datetime-edit-fields-wrapper {
            direction: ltr;
          }
          input[type="date"]::-webkit-datetime-edit {
            direction: ltr;
          }
          input[type="date"]::-webkit-datetime-edit-day-field {
            direction: ltr;
          }
          input[type="date"]::-webkit-datetime-edit-month-field {
            direction: ltr;
          }
          input[type="date"]::-webkit-datetime-edit-year-field {
            direction: ltr;
          }
        `}
      </style>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69898c8a35cb50ac3a0773f5/2f988bf8f_image.png" 
            alt="All4Shop Logo" 
            className="h-12"
          />
          <div className="text-2xl font-bold text-gray-800">
            מערכת ניהול משמרות
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}