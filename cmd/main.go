package main

import (
	"log"
	"os"

	"request-policy/internal/web"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime)
	log.SetOutput(os.Stdout)

	log.Println("Client-Server Simulation")

	dashboard := web.NewDashboard()
	dashboard.ListenAndServe()
}
