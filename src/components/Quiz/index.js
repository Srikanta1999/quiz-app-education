import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Segment,
  Item,
  Divider,
  Button,
  Icon,
  Message,
  Menu,
  Header,
  Image,
  Grid,
} from 'semantic-ui-react';
import he from 'he';

import Countdown from '../Countdown';
import { getLetter } from '../../utils';

const Quiz = ({ data, countdownTime, endQuiz, photo, student, quizSession, onSessionUpdate }) => {
  const initialQuestionIndex = quizSession?.currentQuestionIndex ?? 0;
  const initialSelectedAnswers = quizSession?.selectedAnswers || {};
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  const [selectedAnswers, setSelectedAnswers] = useState(initialSelectedAnswers);
  const [userSlectedAns, setUserSlectedAns] = useState(initialSelectedAnswers[initialQuestionIndex] || null);
  const [timeTaken, setTimeTaken] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(countdownTime || 0);
  const [submitMessage, setSubmitMessage] = useState(null);

  const elapsedBeforeResume = quizSession
    ? Math.max(0, Math.floor((Date.now() - quizSession.startTime) / 1000))
    : 0;

  useEffect(() => {
    if (questionIndex > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [questionIndex]);

  useEffect(() => {
    setUserSlectedAns(selectedAnswers[questionIndex] || null);
  }, [questionIndex, selectedAnswers]);

  useEffect(() => {
    if (typeof onSessionUpdate === 'function') {
      onSessionUpdate({ currentQuestionIndex: questionIndex, selectedAnswers });
    }
  }, [questionIndex, selectedAnswers, onSessionUpdate]);

  const handleItemClick = (e, { name }) => {
    setUserSlectedAns(name);
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: name,
    }));
  };

  const buildQuizResults = answers => {
    const questionsAndAnswers = data.map((item, idx) => {
      const userAnswer = answers[idx] || null;
      const correctAnswer = he.decode(item.correct_answer);
      return {
        question: he.decode(item.question),
        user_answer: userAnswer,
        correct_answer: correctAnswer,
        point: userAnswer === correctAnswer ? 1 : 0,
      };
    });

    const correctAnswerCount = questionsAndAnswers.reduce((sum, item) => sum + item.point, 0);
    return { questionsAndAnswers, correctAnswers: correctAnswerCount };
  };

  const handleNext = () => {
    const currentAnswer = userSlectedAns || selectedAnswers[questionIndex] || null;
    if (!currentAnswer) {
      setSubmitMessage('Please choose an answer before moving to the next question.');
      return;
    }

    const nextIndex = questionIndex + 1;
    const nextAnswers = {
      ...selectedAnswers,
      [questionIndex]: currentAnswer,
    };

    if (questionIndex === data.length - 1) {
      const results = buildQuizResults(nextAnswers);
      const totalTimeTaken = (timeTaken || 0) + elapsedBeforeResume * 1000;
      return endQuiz({
        totalQuestions: data.length,
        correctAnswers: results.correctAnswers,
        timeTaken: totalTimeTaken,
        questionsAndAnswers: results.questionsAndAnswers,
        category: data[0]?.category || 'Apptitude',
        difficulty: data[0]?.difficulty || 'N/A',
        quizName: data[0]?.quizName || 'Unknown',
      });
    }

    setSelectedAnswers(nextAnswers);
    setQuestionIndex(nextIndex);
    setSubmitMessage(null);
  };

  const handleBack = () => {
    if (questionIndex === 0) return;
    setQuestionIndex(questionIndex - 1);
    setSubmitMessage(null);
  };

  const timeOver = timeTaken => {
    const results = buildQuizResults(selectedAnswers);
    const totalTimeTaken = (timeTaken || 0) + elapsedBeforeResume * 1000;
    return endQuiz({
      totalQuestions: data.length,
      correctAnswers: results.correctAnswers,
      timeTaken: totalTimeTaken,
      questionsAndAnswers: results.questionsAndAnswers,
      category: data[0]?.category || 'Apptitude',
      difficulty: data[0]?.difficulty || 'N/A',
      quizName: data[0]?.quizName || 'Unknown',
    });
  };

  return (
    <Item.Header>
      <Container>
        <Segment>
          <Item.Group divided>
            <Item>
              <Item.Content>
                <Item.Extra>
                  <Grid stackable verticalAlign="middle">
                    <Grid.Row>
                      <Grid.Column width={16}>
                        <Header as="h1" style={{ marginBottom: '0.75rem' }}>
                          <Icon name="info circle" />
                          <Header.Content>
                            {`Question No.${questionIndex + 1} of ${data.length}`}
                          </Header.Content>
                        </Header>
                        <Message info>
                          <strong>Answer the question below and keep an eye on the timer.</strong>
                        </Message>
                      </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                      <Grid.Column width={6}>
                        <Segment compact textAlign="center" style={{ borderRadius: '12px' }}>
                          {photo ? (
                            <>
                              <Header as="h4">Your exam photo</Header>
                              <Image src={photo} size="small" rounded bordered />
                            </>
                          ) : (
                            <Message info size="small">
                              Photo will appear while answering the quiz.
                            </Message>
                          )}
                        </Segment>
                      </Grid.Column>
                      <Grid.Column width={4} verticalAlign="middle" style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '100%', textAlign: 'left' }}>
                          <div style={{ marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px', fontSize: '1.05rem' }}>{student?.name || 'UNKNOWN'}</div>
                          <div style={{ margin: 0, fontSize: '0.95rem' }}>Reg. no.: {student?.registrationNo || 'N/A'}</div>
                        </div>
                      </Grid.Column>

                      <Grid.Column width={6}>
                        <Segment compact textAlign="center" style={{ borderRadius: '12px' }}>
                          <Header as="h4" style={{ marginBottom: '0.5rem' }}>
                            Time Remaining
                          </Header>
                          <Countdown
                            countdownTime={countdownTime}
                            timeOver={timeOver}
                            setTimeTaken={setTimeTaken}
                            setTimeRemaining={setTimeRemaining}
                          />
                        </Segment>
                      </Grid.Column>
                    </Grid.Row>
                  </Grid>
                </Item.Extra>
                <br />
                <Item.Meta>
                  <Message size="huge" floating>
                    <b>{`Q. ${he.decode(data[questionIndex].question)}`}</b>
                  </Message>
                  <br />
                  <Item.Description>
                    <h3>Please choose one of the following answers:</h3>
                  </Item.Description>
                  <Divider />
                  <Menu vertical fluid size="massive">
                    {data[questionIndex].options.map((option, i) => {
                      const letter = getLetter(i);
                      const decodedOption = he.decode(option);

                      return (
                        <Menu.Item
                          key={decodedOption}
                          name={decodedOption}
                          active={userSlectedAns === decodedOption}
                          onClick={handleItemClick}
                        >
                          <b style={{ marginRight: '8px' }}>{letter}</b>
                          {decodedOption}
                        </Menu.Item>
                      );
                    })}
                  </Menu>
                </Item.Meta>
                <Divider />
                {submitMessage && (
                  <Message warning>
                    <Message.Header>Submission notice</Message.Header>
                    <p>{submitMessage}</p>
                  </Message>
                )}
                <Item.Extra>
                  <Button
                    content="Back"
                    onClick={handleBack}
                    floated="left"
                    size="big"
                    icon="left chevron"
                    labelPosition="left"
                    disabled={questionIndex === 0}
                  />
                  <Button
                    secondary
                    content="Submit Exam"
                    onClick={() => {
                      if (timeRemaining > 300) {
                        setSubmitMessage('You can only submit the exam during the last 5 minutes of the timer.');
                        return;
                      }

                      const currentAnswer = userSlectedAns || selectedAnswers[questionIndex] || null;
                      const finalAnswers = {
                        ...selectedAnswers,
                        [questionIndex]: currentAnswer,
                      };

                      const results = buildQuizResults(finalAnswers);
                      const totalTimeTaken = (timeTaken || 0) + elapsedBeforeResume * 1000;

                      return endQuiz({
                        totalQuestions: data.length,
                        correctAnswers: results.correctAnswers,
                        timeTaken: totalTimeTaken,
                        questionsAndAnswers: results.questionsAndAnswers,
                        category: data[0]?.category || 'Apptitude',
                        difficulty: data[0]?.difficulty || 'N/A',
                        quizName: data[0]?.quizName || 'Unknown',
                      });
                    }}
                    floated="right"
                    size="big"
                    icon="check"
                    labelPosition="right"
                    disabled={timeRemaining <= 0}
                  />
                  <Button
                    primary
                    content="Next"
                    onClick={handleNext}
                    floated="right"
                    size="big"
                    icon="right chevron"
                    labelPosition="right"
                    disabled={!userSlectedAns}
                    style={{ marginRight: '0.5rem' }}
                  />
                </Item.Extra>
              </Item.Content>
            </Item>
          </Item.Group>
        </Segment>
        <br />
      </Container>
    </Item.Header>
  );
};

Quiz.propTypes = {
  data: PropTypes.array.isRequired,
  countdownTime: PropTypes.number.isRequired,
  endQuiz: PropTypes.func.isRequired,
  photo: PropTypes.string,
  student: PropTypes.shape({
    name: PropTypes.string,
    registrationNo: PropTypes.string,
    isAdmin: PropTypes.bool,
  }),
  quizSession: PropTypes.shape({
    startTime: PropTypes.number,
    countdownSeconds: PropTypes.number,
    currentQuestionIndex: PropTypes.number,
    selectedAnswers: PropTypes.object,
  }),
  onSessionUpdate: PropTypes.func,
};

export default Quiz;
