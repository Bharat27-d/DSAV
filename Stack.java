public class Stack {
    private int maxSize;
    private int[] stackArray;
    private int top;

    // Constructor to initialize stack
    public Stack(int size) {
        maxSize = size;
        stackArray = new int[maxSize];
        top = -1;
    }

    // Push element into stack
    public void push(int data) {
        if (isFull()) {
            System.out.println("Stack Overflow! Cannot push " + data);
            return;
        }
        stackArray[++top] = data;
        System.out.println(data + " pushed into stack.");
    }

    // Pop element from stack
    public int pop() {
        if (isEmpty()) {
            System.out.println("Stack Underflow! Cannot pop.");
            return -1;
        }
        return stackArray[top--];
    }

    // Peek top element
    public int peek() {
        if (isEmpty()) {
            System.out.println("Stack is Empty! No top element.");
            return -1;
        }
        return stackArray[top];
    }

    // Check if stack is empty
    public boolean isEmpty() {
        return (top == -1);
    }

    // Check if stack is full
    public boolean isFull() {
        return (top == maxSize - 1);
    }

    // Display stack elements
    public void display() {
        if (isEmpty()) {
            System.out.println("Stack is empty!");
            return;
        }
        System.out.print("Stack elements: ");
        for (int i = 0; i <= top; i++) {
            System.out.print(stackArray[i] + " ");
        }
        System.out.println();
    }

    // Main method to test stack
    public static void main(String[] args) {
        Stack stack = new Stack(5);

        stack.push(10);
        stack.push(20);
        stack.push(30);
        stack.display();
        System.out.println("Popped: " + stack.pop());
        System.out.println("Top element: " + stack.peek());
        stack.display();
    }
}
