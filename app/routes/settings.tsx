import type { Route } from "./+types/settings";
import { useState } from "react";
import { Form, href, redirect } from "react-router";
import { getSettings, saveSettings } from "../utils/db";
import { TopBar } from "../components/TopBar";

export function meta() {
  return [
    { title: "Settings - Asimov" },
    { name: "description", content: "Configure Asimov settings" },
  ];
}

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const settings = await getSettings();
  return { settings };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  
  const apiKey = formData.get("apiKey") as string;
  const baseUrl = formData.get("baseUrl") as string;
  const modelName = formData.get("modelName") as string;
  
  await saveSettings({
    apiKey,
    baseUrl,
    modelName
  });
  
  // Redirect to the index page after saving
  return redirect(href("/"));
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { settings } = loaderData || {};
  const [isSaving, setIsSaving] = useState(false);
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <TopBar currentPage="settings" />

      <main className="container mx-auto px-4 py-8 mt-14">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">Chat Settings</h2>
          
          <Form method="post" onSubmit={() => setIsSaving(true)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  name="apiKey"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={settings?.apiKey || ""}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL
                </label>
                <input
                  type="url"
                  id="baseUrl"
                  name="baseUrl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={settings?.baseUrl || ""}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-1">
                  Model Name
                </label>
                <input
                  type="text"
                  id="modelName"
                  name="modelName"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue={settings?.modelName || ""}
                  placeholder="google:gemini-2.0-flash"
                  required
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
} 