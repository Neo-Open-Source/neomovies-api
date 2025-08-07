package services

import (
	"fmt"
	"net/smtp"
	"strings"

	"neomovies-api/pkg/config"
)

type EmailService struct {
	config *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{
		config: cfg,
	}
}

type EmailOptions struct {
	To      []string
	Subject string
	Body    string
	IsHTML  bool
}

func (s *EmailService) SendEmail(options *EmailOptions) error {
	if s.config.GmailUser == "" || s.config.GmailPassword == "" {
		return fmt.Errorf("Gmail credentials not configured")
	}

	// Gmail SMTP конфигурация
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"
	auth := smtp.PlainAuth("", s.config.GmailUser, s.config.GmailPassword, smtpHost)

	// Создаем заголовки email
	headers := make(map[string]string)
	headers["From"] = s.config.GmailUser
	headers["To"] = strings.Join(options.To, ",")
	headers["Subject"] = options.Subject

	if options.IsHTML {
		headers["MIME-Version"] = "1.0"
		headers["Content-Type"] = "text/html; charset=UTF-8"
	}

	// Формируем сообщение
	message := ""
	for key, value := range headers {
		message += fmt.Sprintf("%s: %s\r\n", key, value)
	}
	message += "\r\n" + options.Body

	// Отправляем email
	err := smtp.SendMail(
		smtpHost+":"+smtpPort,
		auth,
		s.config.GmailUser,
		options.To,
		[]byte(message),
	)

	return err
}

// Предустановленные шаблоны email
func (s *EmailService) SendVerificationEmail(userEmail, code string) error {
	options := &EmailOptions{
		To:      []string{userEmail},
		Subject: "Подтверждение регистрации Neo Movies",
		Body: fmt.Sprintf(`
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h1 style="color: #2196f3;">Neo Movies</h1>
				<p>Здравствуйте!</p>
				<p>Для завершения регистрации введите этот код:</p>
				<div style="
					background: #f5f5f5;
					padding: 20px;
					border-radius: 8px;
					text-align: center;
					font-size: 24px;
					letter-spacing: 4px;
					margin: 20px 0;
				">
					%s
				</div>
				<p>Код действителен в течение 10 минут.</p>
				<p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
			</div>
		`, code),
		IsHTML: true,
	}

	return s.SendEmail(options)
}

func (s *EmailService) SendPasswordResetEmail(userEmail, resetToken string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.config.BaseURL, resetToken)
	
	options := &EmailOptions{
		To:      []string{userEmail},
		Subject: "Сброс пароля Neo Movies",
		Body: fmt.Sprintf(`
			<html>
			<body>
				<h2>Сброс пароля</h2>
				<p>Вы запросили сброс пароля для вашего аккаунта Neo Movies.</p>
				<p>Нажмите на ссылку ниже, чтобы создать новый пароль:</p>
				<p><a href="%s">Сбросить пароль</a></p>
				<p>Ссылка действительна в течение 1 часа.</p>
				<p>Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.</p>
				<br>
				<p>С уважением,<br>Команда Neo Movies</p>
			</body>
			</html>
		`, resetURL),
		IsHTML: true,
	}

	return s.SendEmail(options)
}

func (s *EmailService) SendMovieRecommendationEmail(userEmail, userName string, movies []string) error {
	moviesList := ""
	for _, movie := range movies {
		moviesList += fmt.Sprintf("<li>%s</li>", movie)
	}

	options := &EmailOptions{
		To:      []string{userEmail},
		Subject: "Новые рекомендации фильмов от Neo Movies",
		Body: fmt.Sprintf(`
			<html>
			<body>
				<h2>Привет, %s!</h2>
				<p>У нас есть новые рекомендации фильмов специально для вас:</p>
				<ul>%s</ul>
				<p>Заходите в приложение, чтобы узнать больше деталей!</p>
				<br>
				<p>С уважением,<br>Команда Neo Movies</p>
			</body>
			</html>
		`, userName, moviesList),
		IsHTML: true,
	}

	return s.SendEmail(options)
}