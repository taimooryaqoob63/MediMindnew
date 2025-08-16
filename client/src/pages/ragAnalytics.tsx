
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AnalyticsData {
  responseTimeDistribution: Array<{ time: string; p50: number; p95: number; p99: number }>;
  agentUsage: Array<{ agent: string; usage: number; color: string }>;
  userSatisfaction: Array<{ date: string; rating: number; confidence: number }>;
  queryTypes: Array<{ type: string; count: number; avgResponseTime: number }>;
}

const chartConfig = {
  p50: { label: "P50", color: "hsl(var(--chart-1))" },
  p95: { label: "P95", color: "hsl(var(--chart-2))" },
  p99: { label: "P99", color: "hsl(var(--chart-3))" },
  medical: { label: "Medical Specialist", color: "hsl(var(--chart-1))" },
  compliance: { label: "Compliance Officer", color: "hsl(var(--chart-2))" },
  learning: { label: "Learning Facilitator", color: "hsl(var(--chart-3))" },
};

export default function RAGAnalytics() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['rag-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/rag/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading analytics...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">RAG Performance Analytics</h1>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="agents">Agent Usage</TabsTrigger>
          <TabsTrigger value="satisfaction">User Satisfaction</TabsTrigger>
          <TabsTrigger value="queries">Query Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Response Time Distribution</CardTitle>
              <CardDescription>
                Performance percentiles over time showing system responsiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <LineChart data={analytics?.responseTimeDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="p50" 
                    stroke="var(--color-p50)" 
                    strokeWidth={2}
                    name="50th Percentile"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p95" 
                    stroke="var(--color-p95)" 
                    strokeWidth={2}
                    name="95th Percentile"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p99" 
                    stroke="var(--color-p99)" 
                    strokeWidth={2}
                    name="99th Percentile"
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Utilization</CardTitle>
              <CardDescription>
                Distribution of queries across different AI agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <PieChart>
                  <Pie
                    data={analytics?.agentUsage || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="usage"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics?.agentUsage?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="satisfaction" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Satisfaction Trends</CardTitle>
              <CardDescription>
                User ratings and system confidence over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <LineChart data={analytics?.userSatisfaction || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="rating" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    name="User Rating"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    name="System Confidence"
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Type Analysis</CardTitle>
              <CardDescription>
                Query distribution and average response times by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <BarChart data={analytics?.queryTypes || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Query Count" />
                  <Bar dataKey="avgResponseTime" fill="hsl(var(--chart-2))" name="Avg Response Time (ms)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
