import { Button } from '@/components/ui/button';
import { Users, GraduationCap, Building2, TrendingUp, LogOut, User, Settings } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <User className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <DashboardCard
            title="Total Students"
            value="1,247"
            icon={Users}
            trend="+12%"
            glowColor="blue"
          />
          <DashboardCard
            title="Total Teachers"
            value="84"
            icon={GraduationCap}
            trend="+3%"
            glowColor="purple"
          />
          <DashboardCard
            title="Departments"
            value="12"
            icon={Building2}
            glowColor="blue"
          />
          <DashboardCard
            title="Avg. Attendance"
            value="88.7%"
            icon={TrendingUp}
            trend="+4.2%"
            glowColor="purple"
          />
        </div>

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <DashboardCard title="Department Attendance" className="lg:col-span-2" glowColor="blue">
            <div className="space-y-4 mt-4">
              {[
                { dept: 'Computer Science', rate: 92, students: 345 },
                { dept: 'Electrical Engineering', rate: 89, students: 298 },
                { dept: 'Mechanical Engineering', rate: 87, students: 276 },
                { dept: 'Civil Engineering', rate: 85, students: 328 },
              ].map((dept, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dept.dept}</span>
                    <span className="text-primary font-bold">{dept.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full glow-blue transition-all duration-500"
                      style={{ width: `${dept.rate}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{dept.students} students</p>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="System Activity" glowColor="purple">
            <div className="space-y-3 mt-4">
              {[
                { action: 'New student registered', time: '5 min ago', type: 'info' },
                { action: 'Attendance threshold alert', time: '12 min ago', type: 'warning' },
                { action: 'Face data updated', time: '23 min ago', type: 'success' },
                { action: 'New teacher added', time: '1 hour ago', type: 'info' },
                { action: 'System maintenance', time: '2 hours ago', type: 'info' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${
                    activity.type === 'warning' ? 'bg-yellow-400' :
                    activity.type === 'success' ? 'bg-green-400' : 'bg-primary'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Management Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Recent Students" glowColor="blue">
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-sm font-semibold">Name</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold">Dept</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Alex Morgan', dept: 'CS', rate: '95%' },
                    { name: 'Jordan Lee', dept: 'EE', rate: '88%' },
                    { name: 'Taylor Swift', dept: 'ME', rate: '92%' },
                    { name: 'Casey Jones', dept: 'CE', rate: '86%' },
                  ].map((student, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 text-sm">{student.name}</td>
                      <td className="py-2 px-2 text-sm text-muted-foreground">{student.dept}</td>
                      <td className="py-2 px-2 text-sm text-primary font-medium">{student.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="w-full mt-4">View All Students</Button>
          </DashboardCard>

          <DashboardCard title="Teachers Overview" glowColor="purple">
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-sm font-semibold">Name</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold">Dept</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold">Classes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Dr. Smith', dept: 'CS', classes: 4 },
                    { name: 'Prof. Johnson', dept: 'EE', classes: 3 },
                    { name: 'Dr. Williams', dept: 'ME', classes: 5 },
                    { name: 'Prof. Brown', dept: 'CE', classes: 3 },
                  ].map((teacher, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 text-sm">{teacher.name}</td>
                      <td className="py-2 px-2 text-sm text-muted-foreground">{teacher.dept}</td>
                      <td className="py-2 px-2 text-sm text-secondary font-medium">{teacher.classes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="w-full mt-4">View All Teachers</Button>
          </DashboardCard>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
