import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Segment,
  Item,
  Divider,
  Button,
  Message,
  Header,
  Icon,
  Form,
} from 'semantic-ui-react';

import mindImg from '../../images/vitam.jfif';
import QUESTION_DATA from '../../constants/questionData';
import { CATEGORIES } from '../../constants';
import { shuffle } from '../../utils';

const Main = ({ startQuiz, quizSettings }) => {
  const quizzes = Array.isArray(quizSettings) ? quizSettings : [];
  
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(null);

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setShowPasswordPrompt(true);
    setEnteredPassword('');
    setPasswordError(null);
    setError(null);
  };

  const handleBackToSelection = () => {
    setSelectedQuiz(null);
    setShowPasswordPrompt(false);
    setEnteredPassword('');
    setPasswordError(null);
  };

  // Quiz selection screen
  if (!selectedQuiz) {
    return (
      <Container>
        <Segment>
          <Item.Group divided>
            <Item>
              <Item.Image src={mindImg} />
              <Item.Content>
                <Item.Header>
                  <h1>The Ultimate quiz app</h1>
                </Item.Header>

                <Divider />

                <Item.Meta>
                  <Header as="h3">
                    <Icon name="list" /> Select a Quiz
                  </Header>
                  <p>Choose a quiz to begin. Each quiz has its own configuration, questions, and password.</p>
                </Item.Meta>

                <Divider />

                {quizzes.length === 0 ? (
                  <Message warning>
                    <Message.Header>No quizzes available</Message.Header>
                    <p>Please ask your instructor to create a quiz.</p>
                  </Message>
                ) : (
                  <Item.Extra>
                    {quizzes.map(quiz => {
                      const categoryConfig = CATEGORIES.find(item => String(item.value) === String(quiz.category));
                      const categoryLabel = categoryConfig ? categoryConfig.text : 'Unknown';
                      return (
                        <Segment key={quiz.id} style={{ marginBottom: '1rem', paddingBottom: '1rem' }}>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <Header as="h4" style={{ marginTop: 0 }}>{quiz.name}</Header>
                            <p><strong>Category:</strong> {categoryLabel}</p>
                            <p><strong>Questions:</strong> {quiz.numOfQuestions}</p>
                            <p><strong>Time:</strong> {quiz.countdownSeconds} seconds</p>
                          </div>
                          <Button primary onClick={() => handleSelectQuiz(quiz)}>
                            Start this quiz
                          </Button>
                        </Segment>
                      );
                    })}
                  </Item.Extra>
                )}
              </Item.Content>
            </Item>
          </Item.Group>
        </Segment>
      </Container>
    );
  }

  // Password verification screen
  if (showPasswordPrompt) {
    const handlePasswordSubmit = () => {
      setPasswordError(null);

      if (!selectedQuiz.examPassword) {
        setShowPasswordPrompt(false);
        return;
      }

      if (!enteredPassword.trim()) {
        setPasswordError('Please enter the exam password');
        return;
      }

      if (enteredPassword !== selectedQuiz.examPassword) {
        setPasswordError('Incorrect password. Please try again.');
        setEnteredPassword('');
        return;
      }

      setShowPasswordPrompt(false);
    };

    return (
      <Container>
        <Segment>
          <Item.Group divided>
            <Item>
              <Item.Image src={mindImg} />
              <Item.Content>
                <Item.Header>
                  <h1>The Ultimate quiz app</h1>
                </Item.Header>

                <Divider />

                <Item.Meta>
                  <Header as="h3">
                    <Icon name="lock" /> Exam Password Required
                  </Header>
                  <p>Enter the password to proceed with <strong>{selectedQuiz.name}</strong>.</p>
                </Item.Meta>

                <Divider />

                <Item.Extra>
                  <Form error={!!passwordError} onSubmit={handlePasswordSubmit}>
                    <Form.Field>
                      <label>Exam Password</label>
                      <Form.Input
                        type="password"
                        placeholder="Enter exam password"
                        value={enteredPassword}
                        onChange={(e) => setEnteredPassword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                      />
                    </Form.Field>

                    {passwordError && (
                      <Message error>
                        <Message.Header>Error</Message.Header>
                        <p>{passwordError}</p>
                      </Message>
                    )}

                    <Button
                      primary
                      size="big"
                      icon="key"
                      labelPosition="left"
                      content="Verify Password"
                      onClick={handlePasswordSubmit}
                    />
                    <Button
                      style={{ marginLeft: '0.5rem' }}
                      onClick={handleBackToSelection}
                    >
                      Back to quiz selection
                    </Button>
                  </Form>
                </Item.Extra>
              </Item.Content>
            </Item>
          </Item.Group>
        </Segment>
      </Container>
    );
  }

  // Quiz info and start screen
  const handleStartExam = () => {
    setProcessing(true);
    setError(null);

    const categoryConfig = CATEGORIES.find(item => String(item.value) === String(selectedQuiz.category));
    const configuredCategoryLabel = categoryConfig ? categoryConfig.text : 'Not configured';
    const configuredQuestions = selectedQuiz.numOfQuestions || 0;
    const configuredTime = selectedQuiz.countdownSeconds || 0;
    const selectedCategoryKey = String(selectedQuiz.category);
    const categoryQuestions = QUESTION_DATA[selectedCategoryKey] || [];
    const supportedCategories = ['9', '10', '11'];
    const isSupportedCategory = supportedCategories.includes(selectedCategoryKey);

    const buildQuiz = (questions, count) => {
      if (count > questions.length) {
        return null;
      }

      return shuffle(questions)
        .slice(0, count)
        .map(item => ({
          question: item.question,
          correct_answer: item.correct_answer,
          incorrect_answers: item.incorrect_answers,
          options: item.options ? shuffle(item.options) : shuffle([item.correct_answer, ...item.incorrect_answers]),
          category: selectedCategoryKey,
          difficulty: item.difficulty || 'N/A',
          quizName: selectedQuiz.name,
        }));
    };

    if (!isSupportedCategory) {
      setProcessing(false);
      setError({
        message:
          'The current quiz content supports Aptitude, Reasoning, and Coding only. Please ask the admin to select one of these categories.',
      });
      return;
    }

    const results = buildQuiz(categoryQuestions, configuredQuestions);

    if (!results) {
      setProcessing(false);
      setError({
        message: `${configuredCategoryLabel} only contains ${categoryQuestions.length} available questions. Please ask the admin to reduce the number of questions or select a different category.`,
      });
      return;
    }

    setTimeout(() => {
      setProcessing(false);
      startQuiz(results, configuredTime);
    }, 500);
  };

  const categoryConfig = CATEGORIES.find(item => String(item.value) === String(selectedQuiz.category));
  const configuredCategoryLabel = categoryConfig ? categoryConfig.text : 'Not configured';
  const configuredQuestions = selectedQuiz.numOfQuestions || 0;
  const configuredTime = selectedQuiz.countdownSeconds || 0;

  return (
    <Container>
      <Segment>
        <Item.Group divided>
          <Item>
            <Item.Image src={mindImg} />
            <Item.Content>
              <Item.Header>
                <h1>The Ultimate quiz app</h1>
              </Item.Header>

              {error && (
                <Message error onDismiss={() => setError(null)}>
                  <Message.Header>Error!</Message.Header>
                  {error.message}
                </Message>
              )}

              <Divider />

              <Item.Meta>
                <Header as="h3">{selectedQuiz.name}</Header>
                <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                  <strong>Category:</strong> {configuredCategoryLabel}
                </p>
                <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                  <strong>Questions:</strong> {configuredQuestions}
                </p>
                <p style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                  <strong>Time:</strong> {configuredTime} seconds
                </p>
                <p>
                  This exam will start using the selected settings after face verification.
                </p>
              </Item.Meta>

              <Divider />

              <Item.Extra>
                <Button
                  primary
                  size="big"
                  icon="play"
                  labelPosition="left"
                  content={processing ? 'Starting...' : 'START EXAM'}
                  onClick={handleStartExam}
                  disabled={processing}
                />
                <Button
                  style={{ marginLeft: '0.5rem' }}
                  onClick={handleBackToSelection}
                  disabled={processing}
                >
                  Back to quiz selection
                </Button>
              </Item.Extra>
            </Item.Content>
          </Item>
        </Item.Group>
      </Segment>
    </Container>
  );
};

Main.propTypes = {
  startQuiz: PropTypes.func.isRequired,
  quizSettings: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        category: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        numOfQuestions: PropTypes.number,
        countdownSeconds: PropTypes.number,
        examPassword: PropTypes.string,
      })
    ),
    PropTypes.shape({
      category: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      numOfQuestions: PropTypes.number,
      countdownSeconds: PropTypes.number,
      examPassword: PropTypes.string,
    }),
  ]),
};

export default Main;
