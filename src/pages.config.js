/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AllConstraints from './pages/AllConstraints';
import EmployeeConstraints from './pages/EmployeeConstraints';
import EmployeeDashboard from './pages/EmployeeDashboard';
import EmployeePreferences from './pages/EmployeePreferences';
import EmployeeShifts from './pages/EmployeeShifts';
import EmployeeSwaps from './pages/EmployeeSwaps';
import Home from './pages/Home';
import ManageEmployees from './pages/ManageEmployees';
import ManagerDashboard from './pages/ManagerDashboard';
import RecurringConstraints from './pages/RecurringConstraints';
import VacationManagement from './pages/VacationManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AllConstraints": AllConstraints,
    "EmployeeConstraints": EmployeeConstraints,
    "EmployeeDashboard": EmployeeDashboard,
    "EmployeePreferences": EmployeePreferences,
    "EmployeeShifts": EmployeeShifts,
    "EmployeeSwaps": EmployeeSwaps,
    "Home": Home,
    "ManageEmployees": ManageEmployees,
    "ManagerDashboard": ManagerDashboard,
    "RecurringConstraints": RecurringConstraints,
    "VacationManagement": VacationManagement,
}

export const pagesConfig = {
    mainPage: "EmployeeConstraints",
    Pages: PAGES,
    Layout: __Layout,
};