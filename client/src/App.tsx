import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import WorkerLayout from "./layouts/WorkerLayout";
import AdminLayout from "./layouts/AdminLayout";
import LandingPage from "./pages/LandingPage";
// Worker pages
import TodayTasks from "./pages/worker/TodayTasks";
import CalendarOverview from "./pages/worker/CalendarOverview";
import MonthlyReport from "./pages/worker/MonthlyReport";
import Profile from "./pages/worker/Profile";
// Admin pages
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAttendance from "./pages/admin/AdminAttendance";
import ReviewCenter from "./pages/admin/ReviewCenter";
import ReportSummary from "./pages/admin/ReportSummary";
import ReportLeave from "./pages/admin/ReportLeave";
import ReportFee from "./pages/admin/ReportFee";
import AdminConfig from "./pages/admin/AdminConfig";

function Router() {
  return (
    <Switch>
      {/* Landing / Login */}
      <Route path="/" component={LandingPage} />

      {/* Worker Mobile Routes */}
      <Route path="/worker">
        {() => (
          <WorkerLayout>
            <TodayTasks />
          </WorkerLayout>
        )}
      </Route>
      <Route path="/worker/today">
        {() => (
          <WorkerLayout>
            <TodayTasks />
          </WorkerLayout>
        )}
      </Route>
      <Route path="/worker/calendar">
        {() => (
          <WorkerLayout>
            <CalendarOverview />
          </WorkerLayout>
        )}
      </Route>
      <Route path="/worker/monthly">
        {() => (
          <WorkerLayout>
            <MonthlyReport />
          </WorkerLayout>
        )}
      </Route>
      <Route path="/worker/profile">
        {() => (
          <WorkerLayout>
            <Profile />
          </WorkerLayout>
        )}
      </Route>

      {/* Admin Desktop Routes */}
      <Route path="/admin">
        {() => (
          <AdminLayout tab="users">
            <AdminUsers />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/users">
        {() => (
          <AdminLayout tab="users">
            <AdminUsers />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/attendance">
        {() => (
          <AdminLayout tab="attendance">
            <AdminAttendance />
          </AdminLayout>
        )}
      </Route>
      <Route path="/review">
        {() => (
          <AdminLayout tab="review">
            <ReviewCenter />
          </AdminLayout>
        )}
      </Route>
      <Route path="/reports/summary">
        {() => (
          <AdminLayout tab="summary">
            <ReportSummary />
          </AdminLayout>
        )}
      </Route>
      <Route path="/reports/leave">
        {() => (
          <AdminLayout tab="leave">
            <ReportLeave />
          </AdminLayout>
        )}
      </Route>
      <Route path="/reports/fee">
        {() => (
          <AdminLayout tab="fee">
            <ReportFee />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/config">
        {() => (
          <AdminLayout tab="config">
            <AdminConfig />
          </AdminLayout>
        )}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
