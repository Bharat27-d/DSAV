import java.util.Scanner;

class Node {
    int data;
    Node next;
    
    public Node(int data) {
        this.data = data;
        this.next = null;
    }
}

class Linklist {
    Node head;
    
    public Linklist() {
        head = null;
    }
    
    public void insertAtBeginning(int data) {
        Node newNode = new Node(data);
        newNode.next = head;
        head = newNode;
        System.out.println(data + " inserted at beginning");
    }
    
    public void insertAtEnd(int data) {
        Node newNode = new Node(data);
        
        if (head == null) {
            head = newNode;
            System.out.println(data + " inserted at end (empty list)");
            return;
        }
        
        Node temp = head;
        while (temp.next != null) {
            temp = temp.next;
        }
        
        temp.next = newNode;
        System.out.println(data + " inserted at end");
    }
    
    public void insertAtPosition(int data, int position) {
        if (position <= 0) {
            System.out.println("Invalid position! Position should be >= 1");
            return;
        }
        
        if (position == 1) {
            insertAtBeginning(data);
            return;
        }
        
        Node newNode = new Node(data);
        Node temp = head;
        
        for (int i = 1; i < position - 1 && temp != null; i++) {
            temp = temp.next;
        }
        
        if (temp == null) {
            System.out.println("Position out of bounds!");
            return;
        }
        
        newNode.next = temp.next;
        temp.next = newNode;
        System.out.println(data + " inserted at position " + position);
    }
    
    public void deleteFromBeginning() {
        if (head == null) {
            System.out.println("List is empty, nothing to delete");
            return;
        }
        
        int data = head.data;
        head = head.next;
        System.out.println(data + " deleted from beginning");
    }
    
    public void deleteFromEnd() {
        if (head == null) {
            System.out.println("List is empty, nothing to delete");
            return;
        }
        
        if (head.next == null) {
            int data = head.data;
            head = null;
            System.out.println(data + " deleted from end");
            return;
        }
        
        Node temp = head;
        while (temp.next.next != null) {
            temp = temp.next;
        }
        
        int data = temp.next.data;
        temp.next = null;
        System.out.println(data + " deleted from end");
    }
    
    public void deleteFromPosition(int position) {
        if (head == null) {
            System.out.println("List is empty, nothing to delete");
            return;
        }
        
        if (position <= 0) {
            System.out.println("Invalid position! Position should be >= 1");
            return;
        }
        
        if (position == 1) {
            deleteFromBeginning();
            return;
        }
        
        Node temp = head;
        for (int i = 1; i < position - 1 && temp != null; i++) {
            temp = temp.next;
        }
        
        if (temp == null || temp.next == null) {
            System.out.println("Position out of bounds!");
            return;
        }
        
        int data = temp.next.data;
        temp.next = temp.next.next;
        System.out.println(data + " deleted from position " + position);
    }
    
    public void printList() {
        Node temp = head;
        if (temp == null) {
            System.out.println("List is empty");
            return;
        }
        
        System.out.print("LinkedList: ");
        while (temp != null) {
            System.out.print(temp.data);
            if (temp.next != null) {
                System.out.print(" -> ");
            }
            temp = temp.next;
        }
        System.out.println();
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println();
        
        Scanner sc = new Scanner(System.in);
        Linklist list = new Linklist();
        
        System.out.print("Enter number of initial elements: ");
        int n = sc.nextInt();
        
        if (n > 0) {
            System.out.println("Enter the elements:");
            for (int i = 0; i < n; i++) {
                System.out.print("Element " + (i+1) + ": ");
                int data = sc.nextInt();
                list.insertAtEnd(data);
            }
            
            System.out.println("\nInitial list:");
            list.printList();
        }
        
        int choice, data, position;
        
        do {
            System.out.println("\nLinked List Operations:");
            System.out.println("1. Insert at beginning");
            System.out.println("2. Insert at end");
            System.out.println("3. Insert at specific position");
            System.out.println("4. Delete from beginning");
            System.out.println("5. Delete from end");
            System.out.println("6. Delete from specific position");
            System.out.println("7. Display the list");
            System.out.println("0. Exit");
            System.out.print("Enter your choice: ");
            
            choice = sc.nextInt();
            
            switch (choice) {
                case 1:
                    System.out.print("Enter data to insert at beginning: ");
                    data = sc.nextInt();
                    list.insertAtBeginning(data);
                    list.printList();
                    break;
                    
                case 2:
                    System.out.print("Enter data to insert at end: ");
                    data = sc.nextInt();
                    list.insertAtEnd(data);
                    list.printList();
                    break;
                    
                case 3:
                    System.out.print("Enter data to insert: ");
                    data = sc.nextInt();
                    System.out.print("Enter position: ");
                    position = sc.nextInt();
                    list.insertAtPosition(data, position);
                    list.printList();
                    break;
                
                case 4:
                    list.deleteFromBeginning();
                    list.printList();
                    break;
                    
                case 5:
                    list.deleteFromEnd();
                    list.printList();
                    break;
                    
                case 6:
                    System.out.print("Enter position to delete: ");
                    position = sc.nextInt();
                    list.deleteFromPosition(position);
                    list.printList();
                    break;
                    
                case 7:
                    list.printList();
                    break;
                    
                case 0:
                    System.out.println("Exiting program...");
                    break;
                    
                default:
                    System.out.println("Invalid choice! Please try again.");
            }
            
        } while (choice != 0);
        
        sc.close();
    }
}