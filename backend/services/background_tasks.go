package services

import (
	"backend/config"
	"log"
	"time"
)

func StartBackgroundTaskRunner() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		for range ticker.C {
			log.Println("⏰ Running background task: Deadline checks...")

			result, err := config.DB.Exec(`
				DELETE FROM tasks 
				WHERE deadline < CURRENT_TIMESTAMP 
				  AND status != 'completed'
				  AND (accepted = FALSE OR progress < 100)
			`)
			if err != nil {
				log.Println("❌ Error deleting expired tasks:", err)
			} else {
				rowsAffected, _ := result.RowsAffected()
				if rowsAffected > 0 {
					log.Printf("🧹 Deleted %d expired tasks\n", rowsAffected)
				}
			}
		}
	}()
}
