import { Button } from '@/components/ui/button';
import { Users, BookOpen, AlertCircle, LogOut, User, TrendingUp } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const TeacherDashboard = () => {
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
            Teacher Dashboard
          </h1>
          <div className="flex items-center gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <DashboardCard
            title="Total Students"
            value="156"
            icon={Users}
            glowColor="blue"
          />
          <DashboardCard
            title="Classes Today"
            value="4"
            icon={BookOpen}
            glowColor="purple"
          />
          <DashboardCard
            title="Avg. Attendance"
            value="89.2%"
            icon={TrendingUp}
            trend="+3.2%"
            glowColor="blue"
          />
          <DashboardCard
            title="Low Attendance"
            value="12"
            icon={AlertCircle}
            glowColor="purple"
          />
        </div>

        {/* Class Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="My Classes" glowColor="blue">
            <div className="space-y-3">
              {[
                { name: 'Computer Science 101', students: 45, attendance: '91%' },
                { name: 'Data Structures', students: 38, attendance: '87%' },
                { name: 'Algorithms', students: 42, attendance: '93%' },
                { name: 'Web Development', students: 31, attendance: '88%' },
              ].map((classItem, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all hover:glow-border-blue cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{classItem.name}</h3>
                    <span className="text-primary font-bold">{classItem.attendance}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{classItem.students} students enrolled</p>
                </div>
              ))}
            </div>
          </DashboardCard>

          {/* Recent Alerts */}
          <DashboardCard title="Low Attendance Alerts" glowColor="purple">
            <div className="space-y-3">
              {[
                { student: 'John Smith', class: 'CS 101', rate: '65%', status: 'Critical' },
                { student: 'Emma Wilson', class: 'Data Structures', rate: '72%', status: 'Warning' },
                { student: 'Michael Brown', class: 'Algorithms', rate: '68%', status: 'Warning' },
                { student: 'Sarah Davis', class: 'Web Dev', rate: '70%', status: 'Warning' },
              ].map((alert, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{alert.student}</h3>
                      <p className="text-sm text-muted-foreground">{alert.class}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-400">{alert.rate}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        alert.status === 'Critical' ? 'bg-red-400/20 text-red-400' : 'bg-yellow-400/20 text-yellow-400'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Attendance Table */}
        <DashboardCard title="Today's Attendance Overview" className="mt-6" glowColor="blue">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold">Student Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Class</th>
                  <th className="text-left py-3 px-4 font-semibold">Time</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Alice Johnson', class: 'CS 101', time: '09:15 AM', status: 'Present' },
                  { name: 'Bob Williams', class: 'CS 101', time: '09:18 AM', status: 'Present' },
                  { name: 'Charlie Brown', class: 'Data Structures', time: '10:05 AM', status: 'Present' },
                  { name: 'Diana Prince', class: 'Algorithms', time: '-', status: 'Absent' },
                  { name: 'Ethan Hunt', class: 'Web Dev', time: '02:10 PM', status: 'Present' },
                ].map((record, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">{record.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{record.class}</td>
                    <td className="py-3 px-4 text-muted-foreground">{record.time}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        record.status === 'Present' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </main>
    </div>
  );
};

export default TeacherDashboard;
