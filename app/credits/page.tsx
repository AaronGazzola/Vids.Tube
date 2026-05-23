"use client";

import { useCreditsStore } from "@/app/layout.stores";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Coins } from "lucide-react";

const packages = [
  { credits: 100, price: "$5" },
  { credits: 300, price: "$12" },
  { credits: 1000, price: "$35" },
];

const history = [
  { date: "—", type: "Signup grant", amount: "+120" },
  { date: "—", type: "Watched live", amount: "0" },
];

export default function CreditsPage() {
  const balance = useCreditsStore((state) => state.balance);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credits</h1>
        <Badge variant="secondary" className="gap-1 text-base">
          <Coins className="h-4 w-4" />
          {balance}
        </Badge>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Buy credits</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.credits}>
              <CardHeader>
                <CardTitle className="flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  {pkg.credits}
                </CardTitle>
                <CardDescription>{pkg.price}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" disabled>
                  Coming soon
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="text-right">{row.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
