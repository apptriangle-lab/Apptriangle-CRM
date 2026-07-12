import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RbacProvider } from "@/contexts/RbacContext";
import { AppProvider } from "@/contexts/AppContext";
import { TaskStoreProvider } from "@/contexts/TaskStoreContext";
import { SalesStoreProvider } from "@/contexts/SalesStoreContext";
import { StatusConfigProvider } from "@/contexts/StatusConfigContext";
import { PmsTaskModalProvider } from "@/contexts/PmsTaskModalContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import CompanyDetails from "./pages/CompanyDetails";
import Contacts from "./pages/Contacts";
import Tasks from "./pages/Tasks";
import TaskDetails from "./pages/TaskDetails";
import Sales from "./pages/Sales";
import SalesDetails from "./pages/SalesDetails";
import Expenses from "./pages/Expenses";
import Accounts from "./pages/Accounts";
import CompanySalesDetails from "./pages/CompanySalesDetails";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import HR from "./pages/HR";
import HRDetails from "./pages/HRDetails";
import LeaveApplication from "./pages/LeaveApplication";
import Attendance from "./pages/Attendance";
import Lunch from "./pages/Lunch";
import Credentials from "./pages/Credentials";
import RfqList from "./pages/RfqList";
import RfqNew from "./pages/RfqNew";
import RfqDetail from "./pages/RfqDetail";
import PmsProjects from "./pages/pms/PmsProjects";
import { PmsHubShell } from "./components/pms/PmsHubShell";
import { PmsHubAdminRoute } from "./components/pms/PmsHubAdminRoute";
import PmsHubResource from "./pages/pms/PmsHubResource";
import PmsHubDashboard from "./pages/pms/PmsHubDashboard";
import { PmsHubTasksShell } from "./components/pms/PmsHubTasksShell";
import PmsHubTasks from "./pages/pms/PmsHubTasks";
import { PmsProjectShell } from "./components/pms/PmsProjectShell";
import PmsProjectOverview from "./pages/pms/PmsProjectOverview";
import PmsProjectTasks from "./pages/pms/PmsProjectTasks";
import PmsProjectTaskRedirect from "./pages/pms/PmsProjectTaskRedirect";
import PmsProjectKanban from "./pages/pms/PmsProjectKanban";
import PmsProjectCalendar from "./pages/pms/PmsProjectCalendar";
import PmsProjectDocuments from "./pages/pms/PmsProjectDocuments";
import PmsProjectSettings from "./pages/pms/PmsProjectSettings";
import NotFound from "./pages/NotFound";
import NoModuleAccess from "./pages/NoModuleAccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RbacProvider>
          <AppProvider>
            <StatusConfigProvider>
              <TaskStoreProvider>
                <SalesStoreProvider>
                  <BrowserRouter
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                    <PmsTaskModalProvider>
                      <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/no-access" element={<NoModuleAccess />} />
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/companies" element={<Companies />} />
                      <Route path="/companies/:id" element={<CompanyDetails />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/tasks/:id" element={<TaskDetails />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/sales/:id" element={<SalesDetails />} />
                      <Route path="/expenses" element={<Expenses />} />
                      <Route path="/accounts" element={<Accounts />} />
                      <Route path="/companies/:companyId/sales/:saleId" element={<CompanySalesDetails />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/hr" element={<HR />} />
                      <Route path="/hr/:id" element={<HRDetails />} />
                      <Route path="/leaves" element={<LeaveApplication />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/lunch" element={<Lunch />} />
                      <Route path="/credentials" element={<Credentials />} />
                      <Route path="/rfq" element={<RfqList />} />
                      <Route path="/rfq/new" element={<RfqNew />} />
                      <Route path="/rfq/:id" element={<RfqDetail />} />

                      <Route path="/pms" element={<PmsHubShell />}>
                        <Route index element={<PmsProjects />} />
                        <Route
                          path="resource"
                          element={
                            <PmsHubAdminRoute permission="canViewResource">
                              <PmsHubResource />
                            </PmsHubAdminRoute>
                          }
                        />
                        <Route
                          path="dashboard"
                          element={
                            <PmsHubAdminRoute permission="canViewHubDashboard">
                              <PmsHubDashboard />
                            </PmsHubAdminRoute>
                          }
                        />
                        <Route path="tasks" element={<PmsHubTasksShell />}>
                          <Route index element={<PmsHubTasks />} />
                          <Route path="kanban" element={<Navigate to="/pms/tasks" replace />} />
                          <Route path="calendar" element={<Navigate to="/pms/tasks" replace />} />
                        </Route>
                      </Route>
                      <Route path="/pms/projects" element={<Navigate to="/pms" replace />} />
                      <Route path="/pms/projects/:projectId" element={<PmsProjectShell />}>
                        <Route index element={<Navigate to="tasks" replace />} />
                        <Route path="dashboard" element={<PmsProjectOverview />} />
                        <Route path="tasks" element={<PmsProjectTasks />} />
                        <Route path="tasks/:taskId" element={<PmsProjectTaskRedirect />} />
                        <Route path="kanban" element={<PmsProjectKanban />} />
                        <Route path="calendar" element={<PmsProjectCalendar />} />
                        <Route path="documents" element={<PmsProjectDocuments />} />
                        <Route path="sprints" element={<Navigate to="tasks" replace />} />
                        <Route path="my-tasks" element={<Navigate to="tasks" replace />} />
                        <Route path="settings" element={<PmsProjectSettings />} />
                      </Route>
                      <Route path="/pms/kanban" element={<Navigate to="/pms/tasks" replace />} />
                      <Route path="/pms/calendar" element={<Navigate to="/pms/tasks" replace />} />
                      <Route path="/pms/my-tasks" element={<Navigate to="/pms/tasks" replace />} />
                      <Route path="/pms/settings" element={<Navigate to="/pms" replace />} />

                      <Route path="*" element={<NotFound />} />
                      </Routes>
                    </PmsTaskModalProvider>
                  </BrowserRouter>
                </SalesStoreProvider>
              </TaskStoreProvider>
            </StatusConfigProvider>
          </AppProvider>
        </RbacProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
