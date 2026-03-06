import React from 'react';
import Layout from '@theme/Layout';
import AgentCards from '../components/AgentCards';

export default function AgentsPage() {
  return (
    <Layout
      title="Agents Reference"
      description="Explore the JumpStart framework's phase agents, their designated templates, and authorized subagent communication paths.">
      <main>
        <AgentCards />
      </main>
    </Layout>
  );
}